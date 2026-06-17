import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Default: last 3 months if no date filter
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : defaultFrom
  const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')! + 'T23:59:59') : now

  const invoices = await prisma.insuranceInvoice.findMany({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo }
    },
    include: {
      claims: {
        select: {
          id: true,
          claimNo: true,
          carPlate: true,
          insurance: { select: { id: true, name: true, creditTermArDays: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  
  return NextResponse.json(invoices)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { claimIds, invoiceDate: rawInvoiceDate } = body

    if (!claimIds || !Array.isArray(claimIds) || claimIds.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการเคลมที่ต้องการสร้างใบวางบิล' }, { status: 400 })
    }

    // Load claims with parts, labors, insurance info, and expenses
    const claims = await prisma.claim.findMany({
      where: { id: { in: claimIds } },
      include: {
        parts: true,
        labors: true,
        insurance: true,
        expenses: true
      }
    })

    if (claims.length !== claimIds.length) {
      return NextResponse.json({ error: 'พบรายการเคลมบางตัวไม่มีอยู่ในระบบ' }, { status: 400 })
    }

    // Validation: All claims must have the same insurance company
    const insuranceIds = new Set(claims.map(c => c.insuranceId))
    if (insuranceIds.size > 1) {
      return NextResponse.json({ error: 'กรุณาเลือกเคลมที่เป็นของบริษัทประกันเดียวกันเท่านั้น' }, { status: 400 })
    }

    // Validation: None of the claims must already have an invoice
    const alreadyInvoiced = claims.filter(c => c.insuranceInvoiceId)
    if (alreadyInvoiced.length > 0) {
      const claimNos = alreadyInvoiced.map(c => c.claimNo).join(', ')
      return NextResponse.json({ error: `เคสเคลมต่อไปนี้ถูกออกใบวางบิลไปแล้ว: ${claimNos}` }, { status: 400 })
    }

    // Calculations across all selected claims
    let partsTotal = 0
    let laborTotal = 0

    for (const claim of claims) {
      const claimPartsTotal = claim.parts.reduce((s, p) => s + p.priceApprove * p.quantity, 0)
      const claimLaborTotal = claim.labors.reduce((s, l) => s + l.priceApprove, 0)

      const claimShippingExpenses = (claim.expenses || []).filter((e: any) => {
        if (!e.billable) return false
        const cat = e.category?.toLowerCase() || ''
        const desc = e.description?.toLowerCase() || ''
        return (
          cat === 'shipping' ||
          cat === 'handling' ||
          cat === 'towing' ||
          desc.includes('ขนส่ง') ||
          desc.includes('shipping') ||
          desc.includes('ส่งอะไหล่') ||
          desc.includes('ค่าส่ง') ||
          desc.includes('ค่าขน')
        )
      })
      const claimExpensesTotal = claimShippingExpenses.reduce((s, e) => s + e.amount, 0)

      partsTotal += claimPartsTotal + claimExpensesTotal
      laborTotal += claimLaborTotal
    }

    const subtotal = partsTotal + laborTotal
    const vatAmount = Math.round(subtotal * 0.07 * 100) / 100
    const grandTotal = Math.round((subtotal + vatAmount) * 100) / 100

    // Generate Invoice Number sequential in IVT-YYYYMMXXXXX format
    const now = new Date()
    const yyyymm = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `IVT-${yyyymm}`
    const count = await prisma.insuranceInvoice.count({
      where: { invoiceNo: { startsWith: 'IVT-' } }
    })
    const nextNo = 1 + count
    const seqNo = String(nextNo).padStart(5, '0')
    const invoiceNo = `${prefix}${seqNo}`

    const invoiceDate = new Date(rawInvoiceDate || Date.now())
    const creditTermDays = claims[0]?.insurance?.creditTermArDays ?? 30
    const dueDate = new Date(invoiceDate)
    dueDate.setDate(dueDate.getDate() + creditTermDays)

    // Create the Insurance Invoice record
    const newInvoice = await prisma.insuranceInvoice.create({
      data: {
        invoiceNo,
        invoiceDate,
        dueDate,
        laborTotal,
        partsTotal,
        subtotal,
        vatAmount,
        grandTotal,
        status: 'PENDING',
        claims: {
          connect: claimIds.map(id => ({ id }))
        }
      }
    })

    // Update the claims status to INVOICE_SENT
    await prisma.claim.updateMany({
      where: { id: { in: claimIds } },
      data: { status: 'INVOICE_SENT' }
    })

    // Create status logs for all updated claims
    for (const c of claims) {
      await prisma.claimStatusLog.create({
        data: {
          claimId: c.id,
          fromStatus: c.status,
          toStatus: 'INVOICE_SENT',
          changedBy: 'system',
          note: `สร้างใบวางบิลรวมเลขที่ ${invoiceNo}`
        }
      }).catch(err => console.error('Error creating ClaimStatusLog:', err))
    }

    return NextResponse.json(newInvoice, { status: 201 })
  } catch (err: any) {
    console.error('Create Consolidated Invoice Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
