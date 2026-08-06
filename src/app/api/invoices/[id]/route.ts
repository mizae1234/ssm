import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    const body = await request.json()
    const { invoiceNo, invoiceDate, dueDate, laborTotal, partsTotal } = body

    if (!invoiceNo) {
      return NextResponse.json({ error: 'กรุณากรอกเลขที่ใบแจ้งหนี้' }, { status: 400 })
    }

    // Check for duplicate invoiceNo (case-insensitive)
    const existing = await prisma.insuranceInvoice.findFirst({
      where: {
        invoiceNo: {
          equals: invoiceNo,
          mode: 'insensitive'
        },
        id: { not: id }
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'เลขที่ใบแจ้งหนี้ซ้ำในระบบ กรุณากรอกเลขอื่น' }, { status: 400 })
    }

    const labor = typeof laborTotal === 'number' ? laborTotal : 0
    const parts = typeof partsTotal === 'number' ? partsTotal : 0
    const subtotal = labor + parts
    const vatAmount = Math.round(subtotal * 0.07 * 100) / 100
    const grandTotal = Math.round((subtotal + vatAmount) * 100) / 100

    const updated = await prisma.insuranceInvoice.update({
      where: { id },
      data: {
        invoiceNo,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        laborTotal: labor,
        partsTotal: parts,
        subtotal,
        vatAmount,
        grandTotal
      }
    })

    return NextResponse.json(updated)
  } catch (err: any) {
    console.error('Update Invoice Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
