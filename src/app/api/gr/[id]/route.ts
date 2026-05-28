import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } } // params.id is goodsReceiptId
) {
  try {
    // 1. Fetch the GoodsReceipt with items, po, and claim
    const gr = await prisma.goodsReceipt.findUnique({
      where: { id: params.id },
      include: {
        items: {
          include: {
            poItem: true
          }
        },
        po: {
          include: {
            claim: true,
            items: true
          }
        }
      }
    })

    if (!gr) {
      return NextResponse.json({ error: 'ไม่พบรายการใบรับสินค้า (GR)' }, { status: 404 })
    }

    const { po, items } = gr
    const claim = po.claim

    // 2. Perform database operations in a transaction
    await prisma.$transaction(async (tx) => {
      // A. Manually delete associated DeliveryOrder if any
      await tx.deliveryOrder.deleteMany({
        where: { goodsReceiptId: gr.id }
      })

      // B. Adjust stock (decrement stock of received items)
      for (const item of items) {
        if (item.quantity <= 0) continue
        const poItem = item.poItem

        // Decrement PartMaster stock
        await tx.partMaster.updateMany({
          where: { partNo: poItem.partNo },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        })

        // Decrement StockBalance
        await tx.stockBalance.updateMany({
          where: { partNo: poItem.partNo },
          data: {
            quantity: {
              decrement: item.quantity
            }
          }
        })

        // Create Compensating StockMovement (OUT)
        await tx.stockMovement.create({
          data: {
            partNo: poItem.partNo,
            partName: poItem.description,
            movementType: 'OUT',
            quantity: item.quantity,
            claimId: claim.id,
            vendorId: po.vendorId,
            note: `ยกเลิกการตรวจรับของจาก PO: ${po.poNo} (GR: ${gr.id})`
          }
        })
      }

      // C. Delete the GoodsReceipt itself (which cascades to GoodsReceiptItems)
      await tx.goodsReceipt.delete({
        where: { id: gr.id }
      })

      // D. Recalculate PO Status
      // Fetch all remaining GR items for this PO
      const remainingGrItems = await tx.goodsReceiptItem.findMany({
        where: {
          goodsReceipt: {
            poId: po.id
          }
        }
      })

      const totalReceivedMap: Record<string, number> = {}
      remainingGrItems.forEach(item => {
        totalReceivedMap[item.poItemId] = (totalReceivedMap[item.poItemId] || 0) + item.quantity
      })

      // Determine new PO Status
      let totalReceivedQty = 0
      let isFullyReceived = true
      
      for (const poItem of po.items) {
        const totalRec = totalReceivedMap[poItem.id] || 0
        totalReceivedQty += totalRec
        if (totalRec < poItem.quantity) {
          isFullyReceived = false
        }
      }

      let newPOStatus: 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' = 'SENT'
      if (totalReceivedQty > 0) {
        newPOStatus = isFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED'
      }

      // Update PO Status
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: newPOStatus }
      })

      // E. Recalculate Claim Status
      // Fetch all POs of the claim
      const allClaimPOs = await tx.purchaseOrder.findMany({
        where: { claimId: claim.id }
      })

      // Check if all POs are fully received
      const hasUnreceivedPO = allClaimPOs.some(cpo => {
        const statusToCheck = cpo.id === po.id ? newPOStatus : cpo.status
        return statusToCheck !== 'RECEIVED' && statusToCheck !== 'CANCELLED'
      })

      // If the claim is currently GOODS_RECEIVED but we now have unreceived POs, revert to PO_ISSUED
      if (hasUnreceivedPO && claim.status === 'GOODS_RECEIVED') {
        await tx.claim.update({
          where: { id: claim.id },
          data: { status: 'PO_ISSUED' }
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to cancel Goods Receipt:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
