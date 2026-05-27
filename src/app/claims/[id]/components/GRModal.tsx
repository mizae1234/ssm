"use client"

import React, { useState, useEffect } from 'react'
import { X, Package, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface GRModalProps {
  isOpen: boolean
  onClose: () => void
  claim: any
  po: any // selectedPOForGR
  onSuccess: () => void
  showToast: (msg: string) => void
  setErrorModalMsg: (msg: string) => void
}

export default function GRModal({
  isOpen,
  onClose,
  claim,
  po,
  onSuccess,
  showToast,
  setErrorModalMsg
}: GRModalProps) {
  const [grQuantities, setGrQuantities] = useState<Record<string, number>>({})
  const [grReceivedBy, setGrReceivedBy] = useState('admin')
  const [grNote, setGrNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen || !po) return
    const initQ: Record<string, number> = {}
    po.items.forEach((item: any) => {
      const prevRec = (item.goodsReceiptItems || []).reduce((s: number, g: any) => s + g.quantity, 0)
      initQ[item.id] = Math.max(0, item.quantity - prevRec)
    })
    setGrQuantities(initQ)
    setGrReceivedBy('admin')
    setGrNote('')
  }, [isOpen, po])

  if (!isOpen || !po) return null

  const handleSave = async () => {
    if (!grReceivedBy.trim()) {
      showToast('กรุณาระบุชื่อผู้ตรวจรับของ')
      return
    }
    const payloadItems = Object.entries(grQuantities)
      .filter(([_, q]) => q > 0)
      .map(([id, q]) => ({ poItemId: id, quantity: q }))

    if (payloadItems.length === 0) {
      showToast('กรุณาระบุจำนวนตรวจรับอย่างน้อย 1 ชิ้น')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/claims/${claim.id}/pos/${po.id}/gr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedBy: grReceivedBy,
          note: grNote,
          items: payloadItems
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'บันทึกไม่สำเร็จ')
      }

      showToast('บันทึกตรวจรับสินค้าสำเร็จ')
      onSuccess()
      onClose()
    } catch (err: any) {
      setErrorModalMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5 text-[#0d9488]" />
            บันทึกการตรวจรับของ (GR) - {po.poNo}
          </CardTitle>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isSaving}>
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="text-sm bg-slate-50 p-3 rounded-lg flex flex-wrap gap-x-6 gap-y-1 text-slate-600">
            <div>ผู้จำหน่าย: <strong className="text-slate-800">{po.vendor?.name}</strong></div>
            <div>เลขที่เคลม: <strong className="text-slate-800">{claim.claimNo}</strong></div>
          </div>

          <div className="overflow-x-auto max-h-[300px] border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>ชิ้นส่วนอะไหล่</TableHead>
                  <TableHead className="text-center w-24">สั่งซื้อ</TableHead>
                  <TableHead className="text-center w-24">รับแล้ว</TableHead>
                  <TableHead className="text-center w-24">ค้างส่ง</TableHead>
                  <TableHead className="text-center w-32">จำนวนที่ตรวจรับรอบนี้</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.items.map((item: any) => {
                  const prevRec = (item.goodsReceiptItems || []).reduce((s: number, g: any) => s + g.quantity, 0)
                  const remaining = Math.max(0, item.quantity - prevRec)
                  const currentVal = grQuantities[item.id] || 0

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.description}
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.partNo}</p>
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-center text-slate-500">{prevRec}</TableCell>
                      <TableCell className="text-center font-semibold text-slate-700">{remaining}</TableCell>
                      <TableCell className="text-center">
                        <input
                          type="number"
                          min="0"
                          max={remaining}
                          disabled={remaining === 0 || isSaving}
                          value={remaining === 0 ? 0 : currentVal}
                          onChange={e => {
                            const val = Math.min(remaining, Math.max(0, parseInt(e.target.value) || 0))
                            setGrQuantities(prev => ({ ...prev, [item.id]: val }))
                          }}
                          className="w-20 text-center bg-white border border-slate-200 focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] rounded py-1 px-1.5 text-sm font-semibold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#475569] uppercase tracking-wider block mb-1">ผู้ตรวจรับของ</label>
              <Input 
                type="text" 
                value={grReceivedBy} 
                onChange={e => setGrReceivedBy(e.target.value)} 
                placeholder="กรอกชื่อผู้รับของ..."
                disabled={isSaving}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#475569] uppercase tracking-wider block mb-1">หมายเหตุเพิ่มเติม</label>
              <Input 
                type="text" 
                value={grNote} 
                onChange={e => setGrNote(e.target.value)} 
                placeholder="ระบุหมายเหตุการรับ..."
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>ยกเลิก</Button>
            <Button 
              className="bg-[#0d9488] hover:bg-[#0f766e] text-white" 
              disabled={!grReceivedBy.trim() || Object.values(grQuantities).every(q => q === 0) || isSaving}
              onClick={handleSave}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกรับของ'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
