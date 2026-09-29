import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vendorId = searchParams.get('vendorId') || undefined
    const vendorSearch = searchParams.get('vendorSearch')?.trim() || searchParams.get('vendor')?.trim() || undefined
    const statusParam = searchParams.get('status') || 'ACTIVE'
    const poType = searchParams.get('poType') || undefined
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
      // First day of current month
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      dateFrom = new Date(`${y}-${m}-01T00:00:00+07:00`)
    }

    if (toStr) {
      dateTo = new Date(`${toStr}T23:59:59.999+07:00`)
    } else {
      dateTo = new Date()
    }

    // Build where clause for PurchaseOrder
    const where: Prisma.PurchaseOrderWhereInput = {
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    }

    // Vendor filter: supports freetext vendorSearch or specific vendorId
    if (vendorSearch) {
      where.vendor = {
        OR: [
          { name: { contains: vendorSearch, mode: 'insensitive' } },
          { peakVendorCode: { contains: vendorSearch, mode: 'insensitive' } },
          { id: { contains: vendorSearch, mode: 'insensitive' } },
        ],
      }
    } else if (vendorId) {
      where.vendorId = vendorId
    }

    // Status filter
    if (statusParam === 'ACTIVE') {
      where.status = { not: 'CANCELLED' }
    } else if (statusParam !== 'ALL' && statusParam) {
      where.status = statusParam as any
    }

    // PO Type filter
    if (poType && poType !== 'ALL') {
      where.poType = poType as any
    }

    // Search filter across PO no, Claim no, Car plate, Vendor name
    if (search) {
      where.OR = [
        { poNo: { contains: search, mode: 'insensitive' } },
        { vendor: { name: { contains: search, mode: 'insensitive' } } },
        { claim: { claimNo: { contains: search, mode: 'insensitive' } } },
        { claim: { carPlate: { contains: search, mode: 'insensitive' } } },
        {
          items: {
            some: {
              OR: [
                { partNo: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ]
    }

    // Fetch PurchaseOrders with vendor, claim, and items
    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            vendorType: true,
            taxId: true,
            paymentTerms: true,
            peakVendorCode: true,
            phone: true,
            address: true,
          },
        },
        claim: {
          select: {
            id: true,
            claimNo: true,
            carPlate: true,
            carBrand: true,
            carModel: true,
            insuredName: true,
            insurance: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        items: {
          select: {
            id: true,
            partNo: true,
            description: true,
            quantity: true,
            unitPrice: true,
            discountPct: true,
            totalPrice: true,
          },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Compute Vendor Summary Aggregation
    const vendorMap = new Map<string, {
      vendorId: string
      vendorCode: string
      vendorName: string
      vendorType: string
      taxId: string
      paymentTerms: number
      poCount: number
      itemCount: number
      subtotal: number
      totalAmount: number
      percentage: number
    }>()

    let grandTotalAmount = 0
    let grandSubtotal = 0
    let grandItemCount = 0

    for (const po of pos) {
      const vId = po.vendorId || 'UNKNOWN'
      grandTotalAmount += po.totalAmount || 0

      let poItemSum = 0
      let poItemQty = 0
      for (const item of po.items) {
        poItemSum += item.totalPrice || 0
        poItemQty += item.quantity || 1
      }
      grandSubtotal += poItemSum
      grandItemCount += poItemQty

      if (!vendorMap.has(vId)) {
        vendorMap.set(vId, {
          vendorId: vId,
          vendorCode: po.vendor?.peakVendorCode || po.vendorId,
          vendorName: po.vendor?.name || 'ไม่ระบุผู้ขาย',
          vendorType: po.vendor?.vendorType || 'PARTS',
          taxId: po.vendor?.taxId || '-',
          paymentTerms: po.vendor?.paymentTerms ?? 30,
          poCount: 0,
          itemCount: 0,
          subtotal: 0,
          totalAmount: 0,
          percentage: 0,
        })
      }

      const vData = vendorMap.get(vId)!
      vData.poCount += 1
      vData.itemCount += poItemQty
      vData.subtotal += poItemSum
      vData.totalAmount += po.totalAmount || 0
    }

    // Calculate percentage share for each vendor
    const byVendor = Array.from(vendorMap.values()).map(v => {
      const percentage = grandTotalAmount > 0
        ? Number(((v.totalAmount / grandTotalAmount) * 100).toFixed(2))
        : 0
      return {
        ...v,
        subtotal: Math.round(v.subtotal * 100) / 100,
        totalAmount: Math.round(v.totalAmount * 100) / 100,
        percentage,
      }
    }).sort((a, b) => b.totalAmount - a.totalAmount)

    // Format detail rows
    const details = pos.map(po => {
      const itemSubtotal = po.items.reduce((sum, it) => sum + (it.totalPrice || 0), 0)
      return {
        id: po.id,
        poNo: po.poNo,
        createdAt: po.createdAt,
        status: po.status,
        poType: po.poType,
        deliveryMode: po.deliveryMode,
        deliveryAddress: po.deliveryAddress,
        totalAmount: po.totalAmount,
        subtotal: Math.round(itemSubtotal * 100) / 100,
        vatAmount: Math.round((po.totalAmount - itemSubtotal) * 100) / 100,
        vendor: {
          id: po.vendor.id,
          name: po.vendor.name,
          vendorType: po.vendor.vendorType,
          taxId: po.vendor.taxId || '-',
          peakVendorCode: po.vendor.peakVendorCode || po.vendor.id,
          paymentTerms: po.vendor.paymentTerms,
        },
        claim: {
          id: po.claim.id,
          claimNo: po.claim.claimNo,
          carPlate: po.claim.carPlate,
          carBrand: po.claim.carBrand,
          carModel: po.claim.carModel,
          insuredName: po.claim.insuredName,
          insuranceName: po.claim.insurance?.name || '-',
        },
        items: po.items.map(it => ({
          id: it.id,
          partNo: it.partNo || '-',
          description: it.description || '-',
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountPct: it.discountPct,
          totalPrice: it.totalPrice,
        })),
      }
    })

    return NextResponse.json({
      summary: {
        totalPOs: pos.length,
        totalVendors: byVendor.length,
        totalItems: grandItemCount,
        grandSubtotal: Math.round(grandSubtotal * 100) / 100,
        grandTotalAmount: Math.round(grandTotalAmount * 100) / 100,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      },
      byVendor,
      details,
    })
  } catch (error: any) {
    console.error('[API] GET /api/reports/purchases error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
