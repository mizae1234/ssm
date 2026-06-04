import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const claim = await prisma.claim.findUnique({
    where: { id: params.id },
    include: {
      insurance: { select: { id: true, name: true, branch: true, taxId: true, branchCode: true, peakCustomerId: true, address: true } },
      garage: { select: { id: true, name: true, phone: true, address: true } },
      parts: { orderBy: { sortOrder: 'asc' }, include: { partMaster: { select: { id: true, partNo: true, partName: true, standardPrice: true } } } },
      labors: { orderBy: { sortOrder: 'asc' } },
      purchaseOrders: { 
        include: { 
          vendor: { select: { id: true, name: true } }, 
          items: {
            include: {
              goodsReceiptItems: true
            }
          },
          goodsReceipts: {
            include: {
              items: {
                include: {
                  poItem: true
                }
              }
            }
          }
        } 
      },
      supplierInvoices: { include: { vendor: { select: { id: true, name: true } }, items: true, apPayment: { select: { id: true, paidAt: true, amount: true } } } },
      garageInvoices: { include: { garage: { select: { id: true, name: true } }, items: true } },
      insuranceInvoice: { include: { arPayment: { select: { id: true, receivedAt: true, amount: true } } } },
      statusLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
      quotations: { include: { laborItems: true, partItems: true } },
      expenses: { orderBy: { createdAt: 'desc' } },
      documents: { orderBy: { createdAt: 'desc' }, take: 30 },
      paymentRequests: { 
        include: { 
          supplierInvoice: { select: { id: true, invoiceNo: true, vendor: { select: { id: true, name: true } } } }, 
          garageInvoice: { select: { id: true, invoiceNo: true, garage: { select: { id: true, name: true } } } }, 
          insuranceInvoice: { select: { id: true, invoiceNo: true } }, 
          billReceipt: true,
          apPayment: true,
          arPayment: true
        } 
      },
    }
  })

  if (!claim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  }
  return NextResponse.json(claim)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  let { parts, labors, garageId, garageName, ...claimData } = body
  
  if (claimData.ePartNo !== undefined) {
    if (!claimData.ePartNo?.trim()) {
      return NextResponse.json({ error: 'กรุณาระบุหมายเลข E-Part' }, { status: 400 })
    }
  }

  const claimNo = claimData.claimNo
  const ePartNo = claimData.ePartNo
  if (claimNo !== undefined || ePartNo !== undefined) {
    const currentClaim = await prisma.claim.findUnique({ where: { id: params.id } })
    if (currentClaim) {
      const finalClaimNo = claimNo !== undefined ? claimNo : currentClaim.claimNo
      const finalEPartNo = ePartNo !== undefined ? ePartNo : (currentClaim.ePartNo || '')
      
      const duplicate = await prisma.claim.findFirst({
        where: {
          id: { not: params.id },
          claimNo: finalClaimNo,
          ePartNo: finalEPartNo
        }
      })
      
      if (duplicate) {
        return NextResponse.json({ error: `เลขที่เคลม ${finalClaimNo} และหมายเลข E-Part ${finalEPartNo} มีอยู่ในระบบแล้ว กรุณาตรวจสอบ` }, { status: 409 })
      }
    }
  }
  
  let finalGarageId = garageId
  if (garageName && garageName.trim()) {
    const existingGarage = await prisma.vendor.findFirst({
      where: {
        name: garageName.trim(),
        vendorType: 'GARAGE'
      }
    })
    
    if (existingGarage) {
      finalGarageId = existingGarage.id
    } else {
      const newGarage = await prisma.vendor.create({
        data: {
          name: garageName.trim(),
          vendorType: 'GARAGE',
          isActive: true
        }
      })
      finalGarageId = newGarage.id
    }
  }

  if (finalGarageId) {
    claimData.garageId = finalGarageId
  }
  
  // Validate parts have names and labors have descriptions
  if (parts && Array.isArray(parts)) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (!p.partName?.trim()) {
        return NextResponse.json({ error: `กรุณาระบุชื่ออะไหล่ให้ครบทุกรายการ (รายการที่ ${i + 1})` }, { status: 400 })
      }
    }
  }

  if (labors && Array.isArray(labors)) {
    for (let i = 0; i < labors.length; i++) {
      const l = labors[i]
      if (!l.description?.trim()) {
        return NextResponse.json({ error: `กรุณาระบุชื่อรายการค่าแรงให้ครบทุกรายการ (รายการที่ ${i + 1})` }, { status: 400 })
      }
    }
  }

  // 1. Update basic claim data if provided
  if (Object.keys(claimData).length > 0) {
    await prisma.claim.update({
      where: { id: params.id },
      data: claimData
    })
  }

  // 2. Safely Update Parts
  if (parts && Array.isArray(parts)) {
    const existingParts = await prisma.claimPart.findMany({ where: { claimId: params.id } })
    const incomingIds = parts.map(p => p.id).filter(id => id && !id.startsWith('new-'))
    const idsToDelete = existingParts.map(p => p.id).filter(id => !incomingIds.includes(id))

    if (idsToDelete.length > 0) {
      await prisma.claimPart.deleteMany({ where: { id: { in: idsToDelete } } })
    }

    for (let index = 0; index < parts.length; index++) {
      const p = parts[index]
      let partMasterId = null
      const partNo = p.partNo?.trim()
      const partName = p.partName?.trim()
      if (partNo) {
        let pm = await prisma.partMaster.findUnique({
          where: { partNo }
        })
        if (!pm) {
          pm = await prisma.partMaster.create({
            data: {
              partNo,
              partName: partName || '',
              category: p.category || null,
              unit: 'ชิ้น',
              standardPrice: Number(p.priceFullAmt || 0),
              peakCode: '',
              source: 'AUTO',
              stock: 0,
              isActive: true,
              partNameAlt: []
            }
          })
          
          await prisma.stockBalance.create({
            data: {
              partNo,
              partName: partName || '',
              quantity: 0
            }
          }).catch(err => console.error('Error creating StockBalance in PUT:', err))
        }
        if (pm) {
          partMasterId = pm.id
        }
      }

      const partData = {
        partNo: partNo || '',
        partName: partName || '',
        priceFullAmt: Number(p.priceFullAmt || 0),
        quantity: Number(p.quantity || 1),
        damageType: p.damageType || 'เปลี่ยน',
        discountPct: Number(p.discountPct || 0),
        priceOffer: Number(p.priceOffer || 0),
        priceApprove: Number(p.priceApprove || 0),
        supplier: p.supplier || '',
        requireReturn: Boolean(p.requireReturn),
        sortOrder: index,
        partMasterId
      }

      if (!p.id || p.id.startsWith('new-')) {
        await prisma.claimPart.create({ data: { ...partData, claimId: params.id } })
      } else {
        await prisma.claimPart.update({ where: { id: p.id }, data: partData })
      }
    }
  }

  // 3. Safely Update Labors
  if (labors && Array.isArray(labors)) {
    const existingLabors = await prisma.claimLabor.findMany({ where: { claimId: params.id } })
    const incomingIds = labors.map(l => l.id).filter(id => id && !id.startsWith('new-'))
    const idsToDelete = existingLabors.map(l => l.id).filter(id => !incomingIds.includes(id))

    if (idsToDelete.length > 0) {
      await prisma.claimLabor.deleteMany({ where: { id: { in: idsToDelete } } })
    }

    for (let index = 0; index < labors.length; index++) {
      const l = labors[index]
      const laborData = {
        description: l.description || '',
        damageLevel: l.damageLevel || 'ปานกลาง',
        discountPct: Number(l.discountPct || 0),
        priceOffer: Number(l.priceOffer || 0),
        priceApprove: Number(l.priceApprove || 0),
        sortOrder: index
      }

      if (!l.id || l.id.startsWith('new-')) {
        await prisma.claimLabor.create({ data: { ...laborData, claimId: params.id } })
      } else {
        await prisma.claimLabor.update({ where: { id: l.id }, data: laborData })
      }
    }
  }
  
  const updatedClaim = await prisma.claim.findUnique({
    where: { id: params.id },
    include: {
      insurance: { select: { id: true, name: true, branch: true, taxId: true, branchCode: true, peakCustomerId: true, address: true } },
      garage: { select: { id: true, name: true, phone: true, address: true } },
      parts: { orderBy: { sortOrder: 'asc' }, include: { partMaster: { select: { id: true, partNo: true, partName: true, standardPrice: true } } } },
      labors: { orderBy: { sortOrder: 'asc' } },
      purchaseOrders: { 
        include: { 
          vendor: { select: { id: true, name: true } }, 
          items: {
            include: {
              goodsReceiptItems: true
            }
          },
          goodsReceipts: {
            include: {
              items: {
                include: {
                  poItem: true
                }
              }
            }
          }
        } 
      },
      supplierInvoices: { include: { vendor: { select: { id: true, name: true } }, items: true, apPayment: { select: { id: true, paidAt: true, amount: true } } } },
      garageInvoices: { include: { garage: { select: { id: true, name: true } }, items: true } },
      insuranceInvoice: { include: { arPayment: { select: { id: true, receivedAt: true, amount: true } } } },
      statusLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
      quotations: { include: { laborItems: true, partItems: true } },
      expenses: { orderBy: { createdAt: 'desc' } },
      documents: { orderBy: { createdAt: 'desc' }, take: 30 },
      paymentRequests: { 
        include: { 
          supplierInvoice: { select: { id: true, invoiceNo: true, vendor: { select: { id: true, name: true } } } }, 
          garageInvoice: { select: { id: true, invoiceNo: true, garage: { select: { id: true, name: true } } } }, 
          insuranceInvoice: { select: { id: true, invoiceNo: true } }, 
          billReceipt: true,
          apPayment: true,
          arPayment: true
        } 
      },
    }
  })
  
  return NextResponse.json(updatedClaim)
}
