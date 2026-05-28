import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const insuranceId = searchParams.get('insuranceId')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const search = searchParams.get('search')
  const page = Number(searchParams.get('page') || '1')
  const limit = Number(searchParams.get('limit') || '10')
  const skip = (page - 1) * limit

  const where: any = {}

  if (status) {
    where.status = status
  }
  if (insuranceId) {
    where.insuranceId = insuranceId
  }
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo) where.createdAt.lte = new Date(dateTo)
  }
  if (search) {
    const s = search.toLowerCase()
    where.OR = [
      { claimNo: { contains: s, mode: 'insensitive' } },
      { carPlate: { contains: s, mode: 'insensitive' } },
      { insuredName: { contains: s, mode: 'insensitive' } },
    ]
  }

  // Count total matching items
  const total = await prisma.claim.count({ where })

  // Calculate status counts matching the other filters (ignoring the status filter itself so status pills show correct counts)
  const statusWhere = { ...where }
  delete statusWhere.status
  const statusCountsData = await prisma.claim.groupBy({
    by: ['status'],
    where: statusWhere,
    _count: true,
  })

  const statusCounts: Record<string, number> = {}
  statusCountsData.forEach(item => {
    statusCounts[item.status] = item._count
  })

  const claims = await prisma.claim.findMany({
    where,
    skip,
    take: limit,
    include: {
      insurance: true,
      garage: true,
      _count: {
        select: { parts: true, labors: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const listData = claims.map(c => ({
    id: c.id,
    claimNo: c.claimNo,
    receiveNo: c.receiveNo,
    carPlate: c.carPlate,
    carBrand: c.carBrand,
    carModel: c.carModel,
    insuredName: c.insuredName,
    province: c.province,
    status: c.status,
    insurance: c.insurance,
    garage: c.garage,
    createdAt: c.createdAt.toISOString(),
    sentAt: c.sentAt?.toISOString(),
    partsCount: c._count.parts,
    laborsCount: c._count.labors,
  }))

  return NextResponse.json({
    claims: listData,
    total,
    statusCounts
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Claim number logic:
  // - E-Claim: use the number from insurance company (body.claim.claimNo.value)
  // - Manual:  generate CLM-YY-MM-NNNNNN (per-month sequential)
  let claimNo = body.claim?.claimNo?.value
  if (!claimNo) {
    const now = new Date()
    const yy = String(now.getFullYear()).slice(2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `CLM-${yy}-${mm}-`
    const count = await prisma.claim.count({
      where: { claimNo: { startsWith: prefix } }
    })
    claimNo = `${prefix}${String(count + 1).padStart(6, '0')}`
  }

  // Check for duplicate claim number
  const existing = await prisma.claim.findUnique({ where: { claimNo } })
  if (existing) {
    return NextResponse.json({ error: `เลขที่เคลม ${claimNo} มีอยู่ในระบบแล้ว กรุณาตรวจสอบ` }, { status: 409 })
  }

  // Ensure insurance and garage exist
  const defaultGarage = await prisma.vendor.findFirst({ where: { vendorType: 'GARAGE' } })

  const rawInsName = body.claim?.insuranceName?.value
  let insuranceId = ''
  if (rawInsName) {
    const cleanName = (name: string) => {
      if (!name) return ''
      return name
        .replace(/บริษัท|จำกัด|มหาชน|บมจ\.|หจก\./g, '')
        .replace(/\s+/g, '')
        .trim()
    }
    const cleanSearch = cleanName(rawInsName)
    
    // Try exact or contains match first directly on the database
    let matchedIns: { id: string; name: string } | null = await prisma.insurance.findFirst({
      where: {
        name: {
          contains: cleanSearch,
          mode: 'insensitive'
        }
      },
      select: { id: true, name: true }
    })

    // Fallback to fuzzy match in JS memory if not found directly
    if (!matchedIns) {
      const insurances = await prisma.insurance.findMany({
        select: { id: true, name: true }
      })
      const found = insurances.find(ins => {
        const dbClean = cleanName(ins.name)
        return dbClean.includes(cleanSearch) || cleanSearch.includes(dbClean)
      })
      matchedIns = found || null
    }

    if (!matchedIns) {
      matchedIns = await prisma.insurance.create({
        data: { name: rawInsName },
        select: { id: true, name: true }
      })
    }
    insuranceId = matchedIns.id
  } else {
    const defaultInsurance = await prisma.insurance.findFirst()
    insuranceId = defaultInsurance?.id || ''
  }

  // Validate parts have names and labors have descriptions
  const partsArray = body.parts || []
  for (let i = 0; i < partsArray.length; i++) {
    const p = partsArray[i]
    if (!p.partName?.value?.trim()) {
      return NextResponse.json({ error: `กรุณาระบุชื่ออะไหล่ให้ครบทุกรายการ (รายการที่ ${i + 1})` }, { status: 400 })
    }
  }

  const laborsArray = body.labors || []
  for (let i = 0; i < laborsArray.length; i++) {
    const l = laborsArray[i]
    if (!l.description?.value?.trim()) {
      return NextResponse.json({ error: `กรุณาระบุชื่อรายการค่าแรงให้ครบทุกรายการ (รายการที่ ${i + 1})` }, { status: 400 })
    }
  }

  // Create / resolve PartMasters first
  const partsToCreate = []
  const partsArray = body.parts || []
  for (let i = 0; i < partsArray.length; i++) {
    const p = partsArray[i]
    const partNo = p.partNo?.value || ''
    const partName = p.partName?.value || ''

    let partMasterId = null
    if (partNo) {
      let pm = await prisma.partMaster.findUnique({
        where: { partNo }
      })

      if (!pm && p.saveToMaster?.value !== false) {
        pm = await prisma.partMaster.create({
          data: {
            partNo,
            partName,
            category: p.category?.value || null,
            unit: 'ชิ้น',
            standardPrice: Number(p.priceFull?.value || 0),
            peakCode: '', // Leave peakCode blank for user to fill later
            source: 'AUTO',
            stock: 0,
            isActive: true,
            partNameAlt: []
          }
        })

        await prisma.stockBalance.create({
          data: {
            partNo,
            partName,
            quantity: 0
          }
        }).catch(err => console.error('Error creating StockBalance:', err))
      }

      if (pm) {
        partMasterId = pm.id
      }
    }

    partsToCreate.push({
      partNo,
      partName,
      priceFullAmt: Number(p.priceFull?.value || 0),
      quantity: Number(p.quantity?.value || 1),
      damageType: p.damageType?.value || '',
      discountPct: Number(p.discountPct?.value || 0),
      priceOffer: Number(p.priceOffer?.value || 0),
      priceApprove: Number(p.priceApprove?.value || 0),
      supplier: p.supplier?.value || '',
      requireReturn: Boolean(p.requireReturn?.value || false),
      partMasterId
    })
  }

  try {
    const newClaim = await prisma.claim.create({
      data: {
        claimNo,
        status: 'RECEIVED',
        receiveNo: body.claim?.receiveNo?.value || '',
        transactionNo: body.claim?.transactionNo?.value || '',
        insuranceId,
        garageId: defaultGarage?.id || '',
        carPlate: body.car?.plate?.value || '',
        carBrand: body.car?.brand?.value || '',
        carModel: body.car?.model?.value || '',
        carVin: body.car?.vin?.value || '',
        carColor: body.car?.color?.value || '',
        province: body.car?.province?.value || '',
        insuredName: body.car?.insuredName?.value || '',
        parts: {
          create: partsToCreate
        },
        labors: {
          create: (body.labors || []).map((l: any) => ({
            description: l.description?.value || '',
            damageLevel: l.damageLevel?.value || '',
            discountPct: Number(l.discountPct?.value || 0),
            priceOffer: Number(l.priceOffer?.value || 0),
            priceApprove: Number(l.priceApprove?.value || 0),
          }))
        }
      },
      include: {
        insurance: true,
      }
    })
    return NextResponse.json(newClaim, { status: 201 })
  } catch (error: any) {
    console.error('Save Claim Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
