"use client"

import React, { useState } from 'react'
import { X, CreditCard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

interface PaymentRequestModalProps {
  isOpen: boolean
  onClose: () => void
  claim: any
  pendingPaymentRequest: { type: 'AP_VENDOR' | 'AP_GARAGE', invoiceId: string, amount: number } | null
  onSuccess: () => void
  showToast: (msg: string) => void
  setErrorModalMsg: (msg: string) => void
}

export default function PaymentRequestModal({
  isOpen,
  onClose,
  claim,
  pendingPaymentRequest,
  onSuccess,
  showToast,
  setErrorModalMsg
}: PaymentRequestModalProps) {
  const [isSaving, setIsSaving] = useState(false)

  if (!isOpen || !pendingPaymentRequest) return null

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/payment-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: pendingPaymentRequest.type,
          claimId: claim.id,
          supplierInvoiceId: pendingPaymentRequest.type === 'AP_VENDOR' ? pendingPaymentRequest.invoiceId : undefined,
          garageInvoiceId: pendingPaymentRequest.type === 'AP_GARAGE' ? pendingPaymentRequest.invoiceId : undefined,
          amount: pendingPaymentRequest.amount,
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to create payment request')
      }

      showToast('สร้างคำขอเบิกจ่ายเงินเรียบร้อย กรุณารอการเงินอนุมัติ')
      onSuccess()
      onClose()
    } catch (err: any) {
      setErrorModalMsg(`เกิดข้อผิดพลาดในการสร้างคำขอเบิกเงิน: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#0d9488]" />
            สร้างคำขอเบิกจ่ายเงิน
          </CardTitle>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isSaving}>
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="bg-[#f8faff] border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-[#94a3b8]">ประเภท</p>
            <p className="font-medium text-sm">
              {pendingPaymentRequest.type === 'AP_VENDOR' ? 'จ่ายเงิน Supplier (ค่าอะไหล่)' : 'จ่ายเงินอู่ (ค่าแรง)'}
            </p>
            <p className="text-xs text-[#94a3b8] mt-2">ยอดเงิน</p>
            <p className="font-bold text-lg text-[#0d9488]">฿{formatCurrency(pendingPaymentRequest.amount)}</p>
          </div>
          <div className="flex gap-3 justify-end border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>ยกเลิก</Button>
            <Button className="bg-[#0d9488] text-white" onClick={handleSave} disabled={isSaving}>
              <CreditCard className="w-4 h-4 mr-1" />
              {isSaving ? 'กำลังสร้าง...' : 'ยืนยันขอเบิกเงิน'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
