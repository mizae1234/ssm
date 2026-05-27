import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string, poId: string } }
) {
  try {
    const body = await request.json()

    if (body.deliveryAddress !== undefined && (!body.deliveryAddress || !body.deliveryAddress.trim())) {
      return NextResponse.json({ error: 'กรุณาระบุที่อยู่สำหรับจัดส่ง' }, { status: 400 })
    }
    
    const subtotal = (body.items || []).reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0)
    const vatPct = body.includeVat !== false ? (body.vatPct ?? 7) : 0
    const totalAmount = subtotal + Math.round(subtotal * (vatPct / 100))
    
    // First, delete existing items (if Prisma requires it when we completely replace items)
    // Or we can use deleteMany + create in the update
    
    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: params.poId },
      data: {
        vendorId: body.vendorId,
        deliveryAddress: body.deliveryAddress !== undefined ? body.deliveryAddress : undefined,
        totalAmount,
        items: {
          deleteMany: {},
          create: (body.items || []).map((item: any) => ({
            partNo: item.partNo || '',
            description: item.description || '',
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            totalPrice: Number(item.totalPrice || 0)
          }))
        }
      },
      include: {
        vendor: true,
        items: {
          include: {
            goodsReceiptItems: true
          }
        },
        goodsReceipts: {
          include: {
            items: true
          }
        }
      }
    })
    
    return NextResponse.json(updatedPO)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string, poId: string } }
) {
  try {
    const body = await request.json()
    
    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: params.poId },
      data: {
        status: body.status
      },
      include: {
        vendor: true,
        items: {
          include: {
            goodsReceiptItems: true
          }
        },
        goodsReceipts: {
          include: {
            items: true
          }
        }
      }
    })
    
    return NextResponse.json(updatedPO)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
