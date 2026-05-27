import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoice = await prisma.insuranceInvoice.findUnique({
      where: { claimId: params.id },
      include: { arPayment: true }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'ไม่พบใบวางบิล' }, { status: 404 })
    }

    if (invoice.arPayment) {
      return NextResponse.json({ error: 'บันทึกรับเงินไปแล้ว' }, { status: 400 })
    }

    const body = await request.json()

    const now = new Date(body.receivedAt || Date.now())
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `REC-${year}${month}`
    
    const count = await prisma.aRPayment.count({
      where: { id: { startsWith: prefix } }
    })
    const seq = String(count + 1).padStart(5, '0')
    const paymentId = `${prefix}${seq}`

    // Create ARPayment and update InsuranceInvoice status to PAID
    const arPayment = await prisma.aRPayment.create({
      data: {
        id: paymentId,
        insuranceInvoiceId: invoice.id,
        amount: invoice.grandTotal,
        receivedAt: now,
        method: body.method || 'โอนเงิน',
        ref: body.ref || null,
      }
    })

    await prisma.insuranceInvoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID' }
    })

    return NextResponse.json(arPayment, { status: 201 })
  } catch (err: any) {
    console.error('Receive AR Payment Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
