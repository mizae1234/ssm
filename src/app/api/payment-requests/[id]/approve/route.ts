import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pr = await prisma.paymentRequest.findUnique({ where: { id: params.id } })
    if (!pr) return NextResponse.json({ error: 'ไม่พบคำขอเบิกเงิน' }, { status: 404 })
    if (pr.status !== 'PENDING_APPROVAL') return NextResponse.json({ error: 'คำขอนี้ถูกดำเนินการไปแล้ว' }, { status: 400 })

    const body = await request.json()

    const updated = await prisma.paymentRequest.update({
      where: { id: params.id },
      data: {
        status: 'APPROVED',
        approvedBy: body.approvedBy || 'การเงิน',
        approvedAt: new Date()
      }
    })

    // Create APPayment / ARPayment with sequence number
    if (updated.requestType === 'AP_VENDOR' || updated.requestType === 'AP_GARAGE') {
      const existing = await prisma.aPPayment.findUnique({
        where: { paymentRequestId: updated.id }
      })
      if (!existing) {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const prefix = `EXP-${year}${month}`
        
        const lastPayment = await prisma.aPPayment.findFirst({
          where: { id: { startsWith: prefix } },
          orderBy: { id: 'desc' },
          select: { id: true }
        })
        let nextNo = 48
        if (lastPayment) {
          const lastSeqStr = lastPayment.id.substring(prefix.length)
          const lastSeq = parseInt(lastSeqStr, 10)
          if (!isNaN(lastSeq)) {
            nextNo = lastSeq + 1
          }
        }
        const seq = String(nextNo).padStart(5, '0')
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
        
        const lastPayment = await prisma.aRPayment.findFirst({
          where: { id: { startsWith: prefix } },
          orderBy: { id: 'desc' },
          select: { id: true }
        })
        let nextNo = 1
        if (lastPayment) {
          const lastSeqStr = lastPayment.id.substring(prefix.length)
          const lastSeq = parseInt(lastSeqStr, 10)
          if (!isNaN(lastSeq)) {
            nextNo = lastSeq + 1
          }
        }
        const seq = String(nextNo).padStart(5, '0')
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

    const fullRequest = await prisma.paymentRequest.findUnique({
      where: { id: params.id },
      include: { apPayment: true, arPayment: true }
    })
    return NextResponse.json(fullRequest)
  } catch (err: any) {
    console.error('Approve Payment Request Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
