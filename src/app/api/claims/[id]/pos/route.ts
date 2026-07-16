import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pos = await prisma.purchaseOrder.findMany({
      where: { claimId: params.id },
      include: {
        vendor: true,
        items: true
      }
    })
    return NextResponse.json(pos)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    if (!body.deliveryAddress || !body.deliveryAddress.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุที่อยู่สำหรับจัดส่ง' }, { status: 400 })
    }
    
    // Generate sequential PO number if not provided
    let poNo = body.poNo
    if (!poNo) {
      const year = new Date().getFullYear()
      const prefix = `PO-${year}-`
      const lastPO = await prisma.purchaseOrder.findFirst({
        where: { poNo: { startsWith: prefix } },
        orderBy: { poNo: 'desc' },
        select: { poNo: true }
      })
      let nextNo = 1
      if (lastPO) {
        const lastSeqStr = lastPO.poNo.substring(prefix.length)
        const lastSeq = parseInt(lastSeqStr, 10)
        if (!isNaN(lastSeq)) {
          nextNo = lastSeq + 1
        }
      }
      poNo = `${prefix}${String(nextNo).padStart(6, '0')}`
    }


    // Calculate total with configurable VAT
    const subtotal = (body.items || []).reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0)
    let totalAmount = subtotal
    if (body.vatAmount !== undefined) {
      totalAmount = subtotal + Number(body.vatAmount || 0)
    } else {
      const vatPct = body.includeVat !== false ? (body.vatPct ?? 7) : 0
      totalAmount = subtotal + (subtotal * (vatPct / 100))
    }
    totalAmount = Math.round(totalAmount * 100) / 100
    
    const newPO = await prisma.purchaseOrder.create({
      data: {
        poNo,
        claimId: params.id,
        vendorId: body.vendorId,
        poType: body.poType || 'PARTS',
        deliveryMode: body.deliveryMode || 'DIRECT_TO_GARAGE',
        deliveryAddress: body.deliveryAddress || null,
        status: body.status || 'DRAFT',
        totalAmount,
        items: {
          create: (body.items || []).map((item: any) => ({
            partNo: item.partNo || '',
            description: item.description || '',
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            discountPct: Number(item.discountPct || 0),
            totalPrice: Number(item.totalPrice || 0)
          }))
        }
      },
      include: {
        vendor: true,
        items: true
      }
    })
    
    return NextResponse.json(newPO, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create PO:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
