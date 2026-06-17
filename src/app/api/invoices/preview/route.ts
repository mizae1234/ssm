import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { claimIds } = body

    if (!claimIds || !Array.isArray(claimIds) || claimIds.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการเคลม' }, { status: 400 })
    }

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

    // Validation: same insurance
    const insuranceIds = new Set(claims.map(c => c.insuranceId))
    if (insuranceIds.size > 1) {
      return NextResponse.json({ error: 'กรุณาเลือกเคลมที่เป็นของบริษัทประกันเดียวกันเท่านั้น' }, { status: 400 })
    }

    let partsTotal = 0
    let laborTotal = 0

    const claimsWithItems = claims.map(c => {
      // Filter billable shipping expenses
      const claimShippingExpenses = (c.expenses || []).filter((e: any) => {
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

      const claimPartsTotal = c.parts.reduce((s, p) => s + p.priceApprove * p.quantity, 0) + claimShippingExpenses.reduce((s, e) => s + e.amount, 0)
      const claimLaborTotal = c.labors.reduce((s, l) => s + l.priceApprove, 0)
      
      partsTotal += claimPartsTotal
      laborTotal += claimLaborTotal

      return {
        id: c.id,
        claimNo: c.claimNo,
        carPlate: c.carPlate,
        carBrand: c.carBrand,
        carModel: c.carModel,
        parts: c.parts.map(p => {
          const discount = p.discountPct || 0
          const basePrice = p.priceOffer || (discount < 100 ? p.priceApprove / (1 - discount / 100) : p.priceApprove)
          return {
            id: p.id,
            partName: p.partName,
            partNo: p.partNo || '-',
            quantity: p.quantity,
            priceOffer: basePrice,
            discountPct: discount,
            priceApprove: p.priceApprove,
            total: p.priceApprove * p.quantity
          }
        }),
        labors: c.labors.map(l => {
          const discount = l.discountPct || 0
          const basePrice = l.priceOffer || (discount < 100 ? l.priceApprove / (1 - discount / 100) : l.priceApprove)
          return {
            id: l.id,
            description: l.description,
            priceOffer: basePrice,
            discountPct: discount,
            priceApprove: l.priceApprove,
            total: l.priceApprove
          }
        }),
        expenses: claimShippingExpenses.map(e => ({
          id: e.id,
          description: e.description || 'ค่าขนส่ง/ส่งอะไหล่',
          amount: e.amount
        })),
        partsTotal: claimPartsTotal,
        laborTotal: claimLaborTotal,
        total: claimPartsTotal + claimLaborTotal
      }
    })

    const subtotal = partsTotal + laborTotal
    const vatAmount = Math.round(subtotal * 0.07 * 100) / 100
    const grandTotal = Math.round((subtotal + vatAmount) * 100) / 100

    return NextResponse.json({
      partsTotal,
      laborTotal,
      subtotal,
      vatAmount,
      grandTotal,
      claims: claimsWithItems
    })
  } catch (err: any) {
    console.error('Invoice Preview Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
