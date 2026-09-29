import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const insuranceId = searchParams.get('insuranceId') || undefined
    const insuranceSearch = searchParams.get('insuranceSearch')?.trim() || searchParams.get('insurance')?.trim() || undefined
    const statusParam = searchParams.get('status') || 'ACTIVE'
    const search = searchParams.get('search')?.trim() || undefined

    // Date range filter — default to current month in Bangkok time (UTC+7)
    const fromStr = searchParams.get('dateFrom')
    const toStr = searchParams.get('dateTo')

    let dateFrom: Date
    let dateTo: Date

    if (fromStr) {
      dateFrom = new Date(`${fromStr}T00:00:00+07:00`)
    } else {
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      dateFrom = new Date(`${y}-${m}-01T00:00:00+07:00`)
    }

    if (toStr) {
      dateTo = new Date(`${toStr}T23:59:59.999+07:00`)
    } else {
      dateTo = new Date()
    }

    // Build where clause for InsuranceInvoice
    const where: Prisma.InsuranceInvoiceWhereInput = {
      invoiceDate: {
        gte: dateFrom,
        lte: dateTo,
      },
    }

    // Status filter
    if (statusParam === 'ACTIVE') {
      where.status = { not: 'CANCELLED' }
    } else if (statusParam !== 'ALL' && statusParam) {
      where.status = statusParam as any
    }

    // Insurance filter: supports freetext search or specific ID
    if (insuranceSearch) {
      where.claims = {
        some: {
          insurance: {
            OR: [
              { name: { contains: insuranceSearch, mode: 'insensitive' } },
              { peakCustomerId: { contains: insuranceSearch, mode: 'insensitive' } },
              { id: { contains: insuranceSearch, mode: 'insensitive' } },
            ],
          },
        },
      }
    } else if (insuranceId) {
      where.claims = {
        some: {
          insuranceId,
        },
      }
    }

    // Global Search across InvoiceNo, ClaimNo, CarPlate, InsuredName
    if (search) {
      where.OR = [
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        {
          claims: {
            some: {
              OR: [
                { claimNo: { contains: search, mode: 'insensitive' } },
                { carPlate: { contains: search, mode: 'insensitive' } },
                { insuredName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ]
    }

    // Fetch invoices with claims and insurance relations
    const invoices = await prisma.insuranceInvoice.findMany({
      where,
      include: {
        claims: {
          select: {
            id: true,
            claimNo: true,
            carPlate: true,
            carBrand: true,
            carModel: true,
            insuredName: true,
            insuranceId: true,
            insurance: {
              select: {
                id: true,
                name: true,
                taxId: true,
                branchCode: true,
                peakCustomerId: true,
                creditTermArDays: true,
              },
            },
          },
        },
        arPayment: {
          select: {
            id: true,
            amount: true,
            receivedAt: true,
            method: true,
          },
        },
      },
      orderBy: { invoiceDate: 'desc' },
    })

    // Compute Summary Aggregation by Insurance Company
    const insuranceMap = new Map<string, {
      insuranceId: string
      insuranceCode: string
      insuranceName: string
      taxId: string
      creditTermDays: number
      invoiceCount: number
      claimCount: number
      partsTotal: number
      laborTotal: number
      subtotal: number
      vatAmount: number
      grandTotal: number
      percentage: number
    }>()

    let grandPartsTotal = 0
    let grandLaborTotal = 0
    let grandSubtotal = 0
    let grandVatAmount = 0
    let grandTotalAmount = 0
    let grandClaimsCount = 0

    for (const inv of invoices) {
      grandPartsTotal += inv.partsTotal || 0
      grandLaborTotal += inv.laborTotal || 0
      grandSubtotal += inv.subtotal || 0
      grandVatAmount += inv.vatAmount || 0
      grandTotalAmount += inv.grandTotal || 0
      grandClaimsCount += inv.claims.length

      // Primary insurance for this invoice
      const primaryClaim = inv.claims[0]
      const ins = primaryClaim?.insurance
      const insId = ins?.id || primaryClaim?.insuranceId || 'UNKNOWN'

      if (!insuranceMap.has(insId)) {
        insuranceMap.set(insId, {
          insuranceId: insId,
          insuranceCode: ins?.peakCustomerId || insId,
          insuranceName: ins?.name || 'ไม่ระบุ บ.ประกัน',
          taxId: ins?.taxId || '-',
          creditTermDays: ins?.creditTermArDays ?? 30,
          invoiceCount: 0,
          claimCount: 0,
          partsTotal: 0,
          laborTotal: 0,
          subtotal: 0,
          vatAmount: 0,
          grandTotal: 0,
          percentage: 0,
        })
      }

      const insData = insuranceMap.get(insId)!
      insData.invoiceCount += 1
      insData.claimCount += inv.claims.length
      insData.partsTotal += inv.partsTotal || 0
      insData.laborTotal += inv.laborTotal || 0
      insData.subtotal += inv.subtotal || 0
      insData.vatAmount += inv.vatAmount || 0
      insData.grandTotal += inv.grandTotal || 0
    }

    // Calculate percentage share
    const byInsurance = Array.from(insuranceMap.values()).map(ins => {
      const percentage = grandTotalAmount > 0
        ? Number(((ins.grandTotal / grandTotalAmount) * 100).toFixed(2))
        : 0
      return {
        ...ins,
        partsTotal: Math.round(ins.partsTotal * 100) / 100,
        laborTotal: Math.round(ins.laborTotal * 100) / 100,
        subtotal: Math.round(ins.subtotal * 100) / 100,
        vatAmount: Math.round(ins.vatAmount * 100) / 100,
        grandTotal: Math.round(ins.grandTotal * 100) / 100,
        percentage,
      }
    }).sort((a, b) => b.grandTotal - a.grandTotal)

    // Format detail rows
    const details = invoices.map(inv => {
      const primaryClaim = inv.claims[0]
      const ins = primaryClaim?.insurance
      return {
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        status: inv.status,
        partsTotal: Math.round(inv.partsTotal * 100) / 100,
        laborTotal: Math.round(inv.laborTotal * 100) / 100,
        subtotal: Math.round(inv.subtotal * 100) / 100,
        vatAmount: Math.round(inv.vatAmount * 100) / 100,
        grandTotal: Math.round(inv.grandTotal * 100) / 100,
        deductible: inv.deductible || 0,
        insurance: {
          id: ins?.id || primaryClaim?.insuranceId || '',
          name: ins?.name || '-',
          taxId: ins?.taxId || '-',
          peakCustomerId: ins?.peakCustomerId || '-',
          creditTermDays: ins?.creditTermArDays ?? 30,
        },
        claims: inv.claims.map(c => ({
          id: c.id,
          claimNo: c.claimNo,
          carPlate: c.carPlate,
          carBrand: c.carBrand,
          carModel: c.carModel,
          insuredName: c.insuredName,
        })),
        isPaid: Boolean(inv.status === 'PAID' || inv.arPayment),
        paidAmount: inv.arPayment?.amount,
        paidDate: inv.arPayment?.receivedAt,
      }
    })

    return NextResponse.json({
      summary: {
        totalInvoices: invoices.length,
        totalClaims: grandClaimsCount,
        totalInsurances: byInsurance.length,
        grandPartsTotal: Math.round(grandPartsTotal * 100) / 100,
        grandLaborTotal: Math.round(grandLaborTotal * 100) / 100,
        grandSubtotal: Math.round(grandSubtotal * 100) / 100,
        grandVatAmount: Math.round(grandVatAmount * 100) / 100,
        grandTotalAmount: Math.round(grandTotalAmount * 100) / 100,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      },
      byInsurance,
      details,
    })
  } catch (error: any) {
    console.error('[API] GET /api/reports/sales error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
