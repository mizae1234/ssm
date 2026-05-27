import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } } // params.id is goodsReceiptId
) {
  try {
    const body = await request.json()
    const { garageId, receivedBy, note } = body

    // 1. Fetch GoodsReceipt with po and items
    const gr = await prisma.goodsReceipt.findUnique({
      where: { id: params.id },
      include: {
        po: {
          include: {
            items: true
          }
        },
        items: {
          include: {
            poItem: true
          }
        }
      }
    })

    if (!gr) {
      return NextResponse.json({ error: 'ไม่พบใบตรวจรับสินค้า (GR)' }, { status: 404 })
    }

    // Check if DeliveryOrder already exists
    const existingDO = await prisma.deliveryOrder.findUnique({
      where: { goodsReceiptId: params.id }
    })
    if (existingDO) {
      return NextResponse.json({ error: 'ใบตรวจรับสินค้านี้เคยออกใบส่งของอู่ไปแล้ว' }, { status: 400 })
    }

    // 2. Perform DB Updates in a Transaction
    const deliveryOrder = await prisma.$transaction(async (tx) => {
      // Create DeliveryOrder
      const doRecord = await tx.deliveryOrder.create({
        data: {
          goodsReceiptId: params.id,
          garageId: garageId || gr.po.vendorId, // Fallback to PO vendorId if not provided
          deliveredAt: new Date(),
          receivedBy: receivedBy || 'admin',
          note: note || null
        }
      })

      // Update Stock (Deduct)
      for (const grItem of gr.items) {
        if (grItem.quantity <= 0) continue
        const partNo = grItem.poItem.partNo
        const partName = grItem.poItem.description

        // Update PartMaster stock
        await tx.partMaster.updateMany({
          where: { partNo: partNo },
          data: {
            stock: {
              decrement: grItem.quantity
            }
          }
        })

        // Update StockBalance
        await tx.stockBalance.upsert({
          where: { partNo: partNo },
          update: {
            quantity: {
              decrement: grItem.quantity
            }
          },
          create: {
            partNo: partNo,
            partName: partName,
            quantity: -grItem.quantity
          }
        })

        // Create StockMovement (OUT)
        await tx.stockMovement.create({
          data: {
            partNo: partNo,
            partName: partName,
            movementType: 'OUT',
            quantity: grItem.quantity,
            claimId: gr.po.claimId,
            vendorId: gr.po.vendorId,
            note: `ส่งมอบของอู่จาก GR: ${gr.id} (DO: ${doRecord.id})`
          }
        })
      }

      return doRecord
    })

    return NextResponse.json(deliveryOrder, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create Delivery Order:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
