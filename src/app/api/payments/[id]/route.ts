import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const updated = await prisma.paymentRequest.update({
      where: { id: params.id },
      data: {
        status: body.status,
        rejectReason: body.rejectReason,
        approvedBy: body.approvedBy,
        approvedAt: body.approvedAt ? new Date(body.approvedAt) : undefined
      }
    })

    if (body.status === 'APPROVED') {
      if (updated.requestType === 'AP_VENDOR' || updated.requestType === 'AP_GARAGE') {
        const existing = await prisma.aPPayment.findUnique({
          where: { paymentRequestId: updated.id }
        })
        if (!existing) {
          const now = new Date()
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const prefix = `EXP-${year}${month}`
          
          const count = await prisma.aPPayment.count({
            where: { id: { startsWith: prefix } }
          })
          const seq = String(count + 1).padStart(5, '0')
          const paymentId = `${prefix}${seq}`

          await prisma.aPPayment.create({
            data: {
              id: paymentId,
              paymentRequestId: updated.id,
              supplierInvoiceId: updated.supplierInvoiceId,
              payType: updated.requestType === 'AP_GARAGE' ? 'GARAGE' : 'VENDOR',
              amount: updated.amount,
              whtAmount: updated.whtAmount,
              paidAt: now,
              method: updated.method,
              ref: updated.note
            }
          })
        }
      } else if (updated.requestType === 'AR') {
        const existing = await prisma.aRPayment.findUnique({
          where: { paymentRequestId: updated.id }
        })
        if (!existing && updated.insuranceInvoiceId) {
          const now = new Date()
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const prefix = `REC-${year}${month}`
          
          const count = await prisma.aRPayment.count({
            where: { id: { startsWith: prefix } }
          })
          const seq = String(count + 1).padStart(5, '0')
          const paymentId = `${prefix}${seq}`

          await prisma.aRPayment.create({
            data: {
              id: paymentId,
              paymentRequestId: updated.id,
              insuranceInvoiceId: updated.insuranceInvoiceId,
              amount: updated.amount,
              receivedAt: now,
              method: updated.method,
              ref: updated.note
            }
          })
        }
      }
    }

    const fullRequest = await prisma.paymentRequest.findUnique({
      where: { id: params.id },
      include: { apPayment: true, arPayment: true }
    })
    return NextResponse.json(fullRequest)
  } catch (error: any) {
    console.error('Payment Update Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
