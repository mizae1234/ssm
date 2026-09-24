import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pr = await prisma.paymentRequest.findUnique({
      where: { id: params.id },
      include: { apPayment: true, arPayment: true }
    })
    if (!pr) {
      return NextResponse.json({ error: 'ไม่พบคำขอเบิกเงิน' }, { status: 404 })
    }

    if (pr.status === 'APPROVED' || pr.apPayment || pr.arPayment) {
      return NextResponse.json({ error: 'ไม่สามารถลบคำขอที่อนุมัติหรือชำระเงินแล้วได้' }, { status: 400 })
    }

    await prisma.billReceipt.deleteMany({ where: { paymentRequestId: params.id } })
    await prisma.paymentRequest.delete({ where: { id: params.id } })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Delete Payment Request Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
