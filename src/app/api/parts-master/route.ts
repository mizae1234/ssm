import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '50')))
  const search = searchParams.get('search') || ''
  const all = searchParams.get('all') === 'true'
  const exportExcel = searchParams.get('export') === 'true'

  const noPeak = searchParams.get('noPeak') === 'true'

  const where: any = {}
  const conditions: any[] = []

  if (search) {
    conditions.push({
      OR: [
        { partNo: { contains: search, mode: 'insensitive' } },
        { partName: { contains: search, mode: 'insensitive' } },
      ]
    })
  }

  if (noPeak) {
    conditions.push({
      OR: [
        { peakCode: null },
        { peakCode: '' }
      ]
    })
  }

  if (conditions.length > 0) {
    where.AND = conditions
  }

  if (exportExcel) {
    const parts = await prisma.partMaster.findMany({
      where,
      orderBy: { partNo: 'asc' }
    })
    return NextResponse.json(parts)
  }

  if (all) {
    // For autocomplete — return just partNo + partName + price, no pagination
    const parts = await prisma.partMaster.findMany({
      where,
      select: { id: true, partNo: true, partName: true, standardPrice: true, category: true },
      orderBy: { partNo: 'asc' }
    })
    return NextResponse.json(parts)
  }

  const [parts, total] = await Promise.all([
    prisma.partMaster.findMany({
      where,
      include: { vendorPrices: true },
      orderBy: { partNo: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.partMaster.count({ where })
  ])
  
  return NextResponse.json({
    data: parts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.partNo || !body.partName) {
      return NextResponse.json({ error: 'รหัสอะไหล่ และ ชื่ออะไหล่ จำเป็นต้องระบุ' }, { status: 400 })
    }
    
    // Check if duplicate partNo
    const existing = await prisma.partMaster.findUnique({
      where: { partNo: body.partNo }
    })
    if (existing) {
      return NextResponse.json({ error: 'รหัสอะไหล่นี้มีอยู่ในระบบแล้ว' }, { status: 400 })
    }

    const created = await prisma.partMaster.create({
      data: {
        partNo: body.partNo,
        partName: body.partName,
        category: body.category || null,
        unit: body.unit || 'ชิ้น',
        standardPrice: body.standardPrice !== null && body.standardPrice !== undefined ? Number(body.standardPrice) : null,
        purchasePrice: body.purchasePrice !== null && body.purchasePrice !== undefined ? Number(body.purchasePrice) : null,
        description: body.description || null,
        peakCode: body.peakCode && String(body.peakCode).trim() ? String(body.peakCode).trim() : body.partNo,
        stock: body.stock !== undefined ? Number(body.stock) : 0,
        isActive: body.isActive !== undefined ? String(body.isActive) === 'true' : true,
        source: 'MANUAL',
        partNameAlt: []
      }
    })
    return NextResponse.json(created)
  } catch (error: any) {
    console.error('Error creating PartMaster:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
