import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; poId: string } }
) {
  try {
    const goodsReceipts = await prisma.goodsReceipt.findMany({
      where: { poId: params.poId },
      include: {
        items: {
          include: {
            poItem: true
          }
        }
      },
      orderBy: { receivedAt: 'desc' }
    })

    return NextResponse.json(goodsReceipts)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; poId: string } }
) {
  try {
    const body = await request.json()
    const { receivedBy, note, items } = body // items is Array<{ poItemId: string, quantity: number }>

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'กรุณาระบุรายการสินค้าที่ตรวจรับ' }, { status: 400 })
    }

    // 1. Fetch the Purchase Order
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: params.poId },
      include: { items: true }
    })

    if (!po) {
      return NextResponse.json({ error: 'ไม่พบใบสั่งซื้อ' }, { status: 404 })
    }

    // 2. Query previously received quantities
    const previousReceiptItems = await prisma.goodsReceiptItem.findMany({
      where: {
        goodsReceipt: {
          poId: params.poId
        }
      }
    })

    // Map previously received quantities by poItemId
    const receivedMap: Record<string, number> = {}
    previousReceiptItems.forEach(item => {
      receivedMap[item.poItemId] = (receivedMap[item.poItemId] || 0) + item.quantity
    })

    // 3. Validate quantities
    for (const item of items) {
      const poItem = po.items.find(pi => pi.id === item.poItemId)
      if (!poItem) {
        return NextResponse.json({ error: `ไม่พบรายการสินค้า POItem: ${item.poItemId} ในใบสั่งซื้อนี้` }, { status: 400 })
      }

      const previouslyReceived = receivedMap[item.poItemId] || 0
      const remaining = poItem.quantity - previouslyReceived

      if (item.quantity > remaining) {
        return NextResponse.json({
          error: `รายการ ${poItem.description} กรอกจำนวนรับเกินสิทธิ์ (ต้องการรับ: ${item.quantity}, ค้างส่ง: ${remaining})`
        }, { status: 400 })
      }
    }

    // 4. Record the GR inside a Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create GoodsReceipt
      const gr = await tx.goodsReceipt.create({
        data: {
          poId: params.poId,
          receivedAt: new Date(),
          receivedBy: receivedBy || 'admin',
          note: note || '',
          items: {
            create: items
              .filter(item => item.quantity > 0)
              .map(item => ({
                poItemId: item.poItemId,
                quantity: item.quantity
              }))
          }
        },
        include: {
          items: true
        }
      })

      // Update stock in PartMaster and StockBalance / StockMovement
      for (const item of items) {
        if (item.quantity <= 0) continue
        const poItem = po.items.find(pi => pi.id === item.poItemId)
        if (poItem) {
          // Update PartMaster stock
          await tx.partMaster.updateMany({
            where: { partNo: poItem.partNo },
            data: {
              stock: {
                increment: item.quantity
              }
            }
          })

          // Update StockBalance
          await tx.stockBalance.upsert({
            where: { partNo: poItem.partNo },
            update: {
              quantity: {
                increment: item.quantity
              }
            },
            create: {
              partNo: poItem.partNo,
              partName: poItem.description,
              quantity: item.quantity
            }
          })

          // Create StockMovement
          await tx.stockMovement.create({
            data: {
              partNo: poItem.partNo,
              partName: poItem.description,
              movementType: 'IN',
              quantity: item.quantity,
              claimId: params.id,
              vendorId: po.vendorId,
              note: `รับเข้าจาก PO: ${po.poNo}`
            }
          })
        }
      }

      // Fetch all items from PO again to check overall completion status
      const allPoItems = po.items
      
      // Calculate total quantities received including this GR
      const allGrItems = await tx.goodsReceiptItem.findMany({
        where: {
          goodsReceipt: {
            poId: params.poId
          }
        }
      })

      const totalReceivedMap: Record<string, number> = {}
      allGrItems.forEach(item => {
        totalReceivedMap[item.poItemId] = (totalReceivedMap[item.poItemId] || 0) + item.quantity
      })

      // Check if fully received
      let isFullyReceived = true
      for (const poItem of allPoItems) {
        const totalRec = totalReceivedMap[poItem.id] || 0
        if (totalRec < poItem.quantity) {
          isFullyReceived = false
          break
        }
      }

      const newStatus = isFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED'

      // Update PurchaseOrder status
      await tx.purchaseOrder.update({
        where: { id: params.poId },
        data: { status: newStatus }
      })

      // Try updating Claim Status if all POs are RECEIVED
      const allClaimPOs = await tx.purchaseOrder.findMany({
        where: { claimId: params.id }
      })

      // Check if all POs for this Claim are now RECEIVED
      const unreceivedPO = allClaimPOs.find(cpo => {
        // If it's the PO we just updated, use the newStatus
        const statusToCheck = cpo.id === params.poId ? newStatus : cpo.status
        return statusToCheck !== 'RECEIVED' && statusToCheck !== 'CANCELLED'
      })

      if (!unreceivedPO) {
        // All POs are received, update claim status to GOODS_RECEIVED
        await tx.claim.update({
          where: { id: params.id },
          data: { status: 'GOODS_RECEIVED' }
        })
      }

      return gr
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Failed to save Goods Receipt:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
