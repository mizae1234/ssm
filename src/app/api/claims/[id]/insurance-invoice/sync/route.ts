import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { syncInsuranceInvoice } from '@/lib/insuranceInvoiceSync'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const claim = await prisma.claim.findUnique({
      where: { id: params.id },
      select: { insuranceInvoiceId: true }
    })

    if (!claim || !claim.insuranceInvoiceId) {
      return NextResponse.json({ error: 'ไม่พบใบวางบิลในเคสนี้' }, { status: 404 })
    }

    const updated = await syncInsuranceInvoice(claim.insuranceInvoiceId)
    if (!updated) {
      return NextResponse.json({ error: 'ไม่สามารถคำนวณยอดใหม่ได้' }, { status: 400 })
    }

    return NextResponse.json(updated)
  } catch (err: any) {
    console.error('Sync Insurance Invoice Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
