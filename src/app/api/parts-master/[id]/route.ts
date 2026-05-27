import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const part = await prisma.partMaster.findUnique({
    where: { id: params.id },
    include: {
      vendorPrices: {
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              phone: true,
            }
          }
        }
      }
    }
  })
  
  if (!part) {
    return NextResponse.json({ error: 'Part not found' }, { status: 404 })
  }

  // Fetch stock movements for this partNo
  const movements = await prisma.stockMovement.findMany({
    where: { partNo: part.partNo },
    orderBy: { createdAt: 'desc' }
  })

  // Resolve Claim and Vendor references for movements
  const claimIds = movements.map(m => m.claimId).filter((id): id is string => !!id)
  const vendorIds = movements.map(m => m.vendorId).filter((id): id is string => !!id)

  const claims = await prisma.claim.findMany({
    where: { id: { in: claimIds } },
    select: { id: true, claimNo: true }
  })

  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, name: true }
  })

  const claimsMap = new Map(claims.map(c => [c.id, c.claimNo]))
  const vendorsMap = new Map(vendors.map(v => [v.id, v.name]))

  const movementsWithRefs = movements.map(m => ({
    ...m,
    claimNo: m.claimId ? claimsMap.get(m.claimId) : null,
    vendorName: m.vendorId ? vendorsMap.get(m.vendorId) : null
  }))
  
  return NextResponse.json({
    ...part,
    movements: movementsWithRefs
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.partNo || !body.partName) {
      return NextResponse.json({ error: 'รหัสอะไหล่ และ ชื่ออะไหล่ จำเป็นต้องระบุ' }, { status: 400 })
    }

    const updated = await prisma.partMaster.update({
      where: { id: params.id },
      data: {
        partNo: body.partNo,
        partName: body.partName,
        category: body.category || null,
        unit: body.unit || 'ชิ้น',
        standardPrice: body.standardPrice !== null && body.standardPrice !== undefined ? Number(body.standardPrice) : null,
        purchasePrice: body.purchasePrice !== null && body.purchasePrice !== undefined ? Number(body.purchasePrice) : null,
        description: body.description || null,
        peakCode: body.peakCode || null,
        stock: body.stock !== undefined ? Number(body.stock) : undefined,
        isActive: body.isActive !== undefined ? String(body.isActive) === 'true' : undefined,
      }
    })
    
    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating PartMaster:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
