"use client"

import React, { useState, useEffect } from 'react'
import { X, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'

interface ReceiveARModalProps {
  isOpen: boolean
  onClose: () => void
  claim: any
  onSuccess: () => void
  showToast: (msg: string) => void
  setErrorModalMsg: (msg: string) => void
}

export default function ReceiveARModal({
  isOpen,
  onClose,
  claim,
  onSuccess,
  showToast,
  setErrorModalMsg
}: ReceiveARModalProps) {
  const [arReceiveDate, setArReceiveDate] = useState(new Date().toISOString().split('T')[0])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setArReceiveDate(new Date().toISOString().split('T')[0])
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/claims/${claim.id}/insurance-invoice/receive-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          method: 'โอนเงิน', 
          receivedAt: arReceiveDate ? new Date(arReceiveDate).toISOString() : undefined 
        })
      })
      if (!res.ok) { 
        const e = await res.json()
        throw new Error(e.error) 
      }
      showToast('บันทึกรับเงินจากบ.ประกันเรียบร้อยแล้ว')
      onSuccess()
      onClose()
    } catch (err: any) { 
      setErrorModalMsg(`เกิดข้อผิดพลาด: ${err.message}`) 
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            บันทึกรับเงินจากบ.ประกัน
          </CardTitle>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isSaving}>
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700">
              ยอดรับ: <span className="font-bold text-lg">฿{formatCurrency(claim.insuranceInvoice?.grandTotal || 0)}</span>
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-[#475569]">วันที่รับเงิน</label>
            <Input 
              type="date" 
              className="mt-1" 
              value={arReceiveDate} 
              onChange={e => setArReceiveDate(e.target.value)} 
              disabled={isSaving}
            />
          </div>
          <div className="flex gap-3 justify-end border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>ยกเลิก</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white animate-fade-in" onClick={handleSave} disabled={isSaving}>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              {isSaving ? 'กำลังบันทึก...' : 'ยืนยันรับเงิน'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
