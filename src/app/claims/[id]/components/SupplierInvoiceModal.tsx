"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { X, Upload, Save, FileText, Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { uploadToR2 } from '@/lib/upload'
import { formatCurrency } from '@/lib/utils'

interface SupplierInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  claim: any
  parts: any[]
  labors: any[]
  vendors: any[]
  targetPoId?: string | null
  onSuccess: (newInv: any, selectedPartIds: string[], selectedLaborIds: string[]) => void
  showToast: (msg: string) => void
  setErrorModalMsg: (msg: string) => void
}

export default function SupplierInvoiceModal({
  isOpen,
  onClose,
  claim,
  parts,
  labors,
  vendors,
  targetPoId,
  onSuccess,
  showToast,
  setErrorModalMsg
}: SupplierInvoiceModalProps) {
  const [uploadedFile, setUploadedFile] = useState<{ name: string, url: string, type: string, file?: File } | null>(null)
  const [uploadMapSelections, setUploadMapSelections] = useState<Record<string, boolean>>({})
  const [uploadItemPrices, setUploadItemPrices] = useState<Record<string, number>>({})
  const [uploadItemDiscounts, setUploadItemDiscounts] = useState<Record<string, number>>({})
  const [globalDiscountPct, setGlobalDiscountPct] = useState<string>('')
  const [customInvoiceNo, setCustomInvoiceNo] = useState('')
  const [invoiceIncludeVat, setInvoiceIncludeVat] = useState(true)
  const [invoiceVatPct, setInvoiceVatPct] = useState(7)
  const [invoiceCustomVat, setInvoiceCustomVat] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [selectedPoId, setSelectedPoId] = useState<string>('')
  const [manualVendorId, setManualVendorId] = useState<string>('')

  const isPartMatchingPoItem = (part: any, poItem: any) => {
    if (part.partNo && poItem.partNo && part.partNo.trim() !== '' && poItem.partNo.trim() !== '') {
      return part.partNo.trim().toLowerCase() === poItem.partNo.trim().toLowerCase()
    }
    const pName = (part.partName || '').trim().toLowerCase()
    const desc = (poItem.description || '').trim().toLowerCase()
    if (pName && desc) {
      return pName === desc || desc.includes(pName) || pName.includes(desc)
    }
    return false
  }

  const isLaborMatchingPoItem = (labor: any, poItem: any) => {
    const lDesc = (labor.description || '').trim().toLowerCase()
    const pDesc = (poItem.description || '').trim().toLowerCase()
    if (lDesc && pDesc) {
      return lDesc === pDesc || pDesc.includes(lDesc) || lDesc.includes(pDesc)
    }
    return false
  }

  const validPOs = useMemo(() => {
    return claim?.purchaseOrders?.filter((po: any) => po.status !== 'CANCELLED') || []
  }, [claim?.purchaseOrders])

  const poPendingCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    validPOs.forEach((po: any) => {
      const pCount = parts.filter(p => p.paymentStatus !== 'INVOICED' && p.paymentStatus !== 'PAID' && po.items.some((pi: any) => isPartMatchingPoItem(p, pi))).length
      const lCount = labors.filter(l => l.paymentStatus !== 'INVOICED' && l.paymentStatus !== 'PAID' && po.items.some((pi: any) => isLaborMatchingPoItem(l, pi))).length
      counts[po.id] = pCount + lCount
    })
    return counts
  }, [validPOs, parts, labors])

  // Active PO and Vendor resolution
  const currentPo = validPOs.find((p: any) => p.id === selectedPoId)
  const activeVendorId = currentPo ? currentPo.vendorId : (manualVendorId || vendors[0]?.id || claim?.garageId || 'ven-p01')
  const vendorData = vendors.find((v: any) => v.id === activeVendorId) || currentPo?.vendor || vendors[0]
  const billingPct = vendorData?.billingPct ?? 100

  // Filter visible items according to selected PO
  const visibleParts = parts
    .filter(p => p.paymentStatus !== 'INVOICED' && p.paymentStatus !== 'PAID')
    .filter(p => currentPo ? currentPo.items.some((pi: any) => isPartMatchingPoItem(p, pi)) : true)

  const visibleLabors = labors
    .filter(l => l.paymentStatus !== 'INVOICED' && l.paymentStatus !== 'PAID')
    .filter(l => currentPo ? currentPo.items.some((pi: any) => isLaborMatchingPoItem(l, pi)) : true)

  // Initialize selected PO when modal opens
  useEffect(() => {
    if (!isOpen) return
    let initialPoId = ''
    if (targetPoId && validPOs.some((p: any) => p.id === targetPoId)) {
      initialPoId = targetPoId
    } else {
      const poWithPending = validPOs.find((po: any) => (poPendingCounts[po.id] || 0) > 0)
      initialPoId = poWithPending?.id || (validPOs.length > 0 ? validPOs[0]?.id : 'MANUAL')
    }
    setSelectedPoId(initialPoId)
    setUploadedFile(null)
    setCustomInvoiceNo('')
    setInvoiceIncludeVat(true)
    setInvoiceVatPct(7)
    setInvoiceCustomVat('')
    setGlobalDiscountPct('')
    if (vendors.length > 0 && !manualVendorId) {
      setManualVendorId(vendors[0].id)
    }
  }, [isOpen, targetPoId, validPOs, poPendingCounts])

  // Setup items selection & pricing when selectedPoId, parts, or labors change
  useEffect(() => {
    if (!isOpen) return

    const initialSelections: Record<string, boolean> = {}
    const initialPrices: Record<string, number> = {}
    const initialDiscounts: Record<string, number> = {}

    visibleParts.forEach(p => {
      initialSelections[p.id] = true
      const poi = currentPo?.items.find((x: any) => isPartMatchingPoItem(p, x)) ||
        validPOs.flatMap((po: any) => po.items).find((x: any) => isPartMatchingPoItem(p, x))
      const base = poi ? (poi.unitPrice * (poi.quantity || 1)) : (p.priceApprove * p.quantity)
      const disc = poi ? 0 : (p.discountPct || 0)
      initialDiscounts[p.id] = disc
      initialPrices[p.id] = base * (1 - disc / 100)
    })

    visibleLabors.forEach(l => {
      initialSelections[l.id] = true
      const pol = currentPo?.items.find((x: any) => isLaborMatchingPoItem(l, x)) ||
        validPOs.flatMap((po: any) => po.items).find((x: any) => isLaborMatchingPoItem(l, x))
      const base = pol ? pol.unitPrice : l.priceApprove
      const disc = pol ? 0 : (l.discountPct || 0)
      initialDiscounts[l.id] = disc
      initialPrices[l.id] = base * (1 - disc / 100)
    })

    setUploadMapSelections(initialSelections)
    setUploadItemPrices(initialPrices)
    setUploadItemDiscounts(initialDiscounts)
  }, [isOpen, selectedPoId, parts, labors, currentPo])

  useEffect(() => {
    if (!isOpen) return

    const handlePaste = (e: ClipboardEvent) => {
      if (isSaving) return

      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        const file = files[0]
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf']
        if (allowedTypes.includes(file.type) || allowedExts.includes(ext)) {
          const url = URL.createObjectURL(file)
          setUploadedFile({ name: file.name, url, type: file.type, file })
          showToast('📋 วางไฟล์จาก Clipboard สำเร็จ')
          e.preventDefault()
          return
        }
      }

      const items = e.clipboardData?.items
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile()
            if (file) {
              const renamedFile = new File([file], `clipboard-invoice-${Date.now()}.png`, { type: file.type })
              const url = URL.createObjectURL(renamedFile)
              setUploadedFile({ name: renamedFile.name, url, type: renamedFile.type, file: renamedFile })
              showToast('📋 วางรูปภาพจาก Clipboard สำเร็จ')
              e.preventDefault()
              break
            }
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [isOpen, isSaving, showToast])

  const getPartBaseAmt = (p: any) => {
    const poi = currentPo?.items.find((x: any) => isPartMatchingPoItem(p, x)) ||
      validPOs.flatMap((po: any) => po.items).find((x: any) => isPartMatchingPoItem(p, x))
    return poi ? (poi.unitPrice * (poi.quantity || 1)) : (p.priceApprove * p.quantity)
  }

  const getLaborBaseAmt = (l: any) => {
    const pol = currentPo?.items.find((x: any) => isLaborMatchingPoItem(l, x)) ||
      validPOs.flatMap((po: any) => po.items).find((x: any) => isLaborMatchingPoItem(l, x))
    return pol ? pol.unitPrice : l.priceApprove
  }

  const getPartPrice = (p: any) => {
    if (uploadItemPrices[p.id] !== undefined) return uploadItemPrices[p.id]
    const disc = uploadItemDiscounts[p.id] ?? 0
    return getPartBaseAmt(p) * (1 - disc / 100)
  }

  const getLaborPrice = (l: any) => {
    if (uploadItemPrices[l.id] !== undefined) return uploadItemPrices[l.id]
    const disc = uploadItemDiscounts[l.id] ?? 0
    return getLaborBaseAmt(l) * (1 - disc / 100)
  }

  const handleGlobalDiscountChange = (val: string) => {
    setGlobalDiscountPct(val)
    const pct = Number(val) || 0
    
    const nextDiscounts = { ...uploadItemDiscounts }
    const nextPrices = { ...uploadItemPrices }
    
    visibleParts.forEach(p => {
      nextDiscounts[p.id] = pct
      const base = getPartBaseAmt(p)
      nextPrices[p.id] = base * (1 - pct / 100)
    })
    
    visibleLabors.forEach(l => {
      nextDiscounts[l.id] = pct
      const base = getLaborBaseAmt(l)
      nextPrices[l.id] = base * (1 - pct / 100)
    })
    
    setUploadItemDiscounts(nextDiscounts)
    setUploadItemPrices(nextPrices)
  }

  if (!isOpen) return null

  const sub = parts.filter(p => uploadMapSelections[p.id]).reduce((s, p) => s + getPartPrice(p), 0) + 
              labors.filter(l => uploadMapSelections[l.id]).reduce((s, l) => s + getLaborPrice(l), 0)
  const calculatedVat = invoiceIncludeVat ? Math.round(sub * (invoiceVatPct / 100) * 100) / 100 : 0
  const vat = invoiceIncludeVat ? (invoiceCustomVat !== '' ? Number(invoiceCustomVat) : calculatedVat) : 0
  const expectedBilling = Math.round(sub * billingPct / 100)

  const handleSave = async () => {
    const selParts = parts.filter(p => uploadMapSelections[p.id])
    const selLabors = labors.filter(l => uploadMapSelections[l.id])
    if (!selParts.length && !selLabors.length) {
      showToast('กรุณาเลือกอย่างน้อย 1 รายการ')
      return
    }

    setIsSaving(true)
    try {
      let pdfUrlToSave = null
      if (uploadedFile?.file) {
        pdfUrlToSave = await uploadToR2(uploadedFile.file, `claims/${claim.id}/invoices`)
      }

      const invoiceNo = customInvoiceNo.trim() || undefined
      const finalVendorId = activeVendorId

      const partItems = selParts.map(p => {
        const price = getPartPrice(p)
        const unitPrice = price / p.quantity
        const poItem = currentPo?.items.find((pi: any) => isPartMatchingPoItem(p, pi)) ||
          validPOs.flatMap((po: any) => po.items).find((pi: any) => isPartMatchingPoItem(p, pi))
        return {
          poItemId: poItem?.id || null,
          claimPartId: p.id,
          partNo: p.partNo,
          description: p.partName,
          quantity: p.quantity,
          unitPrice: unitPrice,
          discountPct: uploadItemDiscounts[p.id] ?? 0,
          totalPrice: price
        }
      })

      const laborItems = selLabors.map(l => {
        const price = getLaborPrice(l)
        const poLabor = currentPo?.items.find((pi: any) => isLaborMatchingPoItem(l, pi)) ||
          validPOs.flatMap((po: any) => po.items).find((pi: any) => isLaborMatchingPoItem(l, pi))
        return {
          poItemId: poLabor?.id || null,
          claimPartId: null,
          claimLaborId: l.id,
          partNo: '',
          description: `[ค่าแรง] ${l.description}`,
          quantity: 1,
          unitPrice: price,
          discountPct: uploadItemDiscounts[l.id] ?? 0,
          totalPrice: price
        }
      })

      const allItems = [...partItems, ...laborItems]

      const res = await fetch(`/api/claims/${claim.id}/supplier-invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: finalVendorId,
          invoiceNo,
          items: allItems,
          pdfUrl: pdfUrlToSave,
          vatAmount: vat,
          laborIds: selLabors.map(l => l.id)
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลบางส่วน')
      }

      const newInv = await res.json()
      newInv.attachmentUrl = uploadedFile?.url || null
      newInv.attachmentName = uploadedFile?.name || null

      onSuccess(newInv, selParts.map(p => p.id), selLabors.map(l => l.id))
      showToast('บันทึก Invoice เรียบร้อย')
      onClose()
    } catch (err: any) {
      setErrorModalMsg(`เกิดข้อผิดพลาด: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const isAllPartsSelected = visibleParts.length > 0 && visibleParts.every(p => !!uploadMapSelections[p.id])
  const isAllLaborsSelected = visibleLabors.length > 0 && visibleLabors.every(l => !!uploadMapSelections[l.id])
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <Card className="w-full max-w-2xl shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#0d9488]" />
            อัพโหลด Invoice (ผู้จัดจำหน่าย)
          </CardTitle>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isSaving}>
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* ─── PO / Vendor Selector ─── */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#0d9488]" />
                เลือก PO / ผู้จัดจำหน่าย (Vendor)
              </label>
              {vendorData && (
                <Badge variant="outline" className="text-[11px] bg-teal-50 text-teal-800 border-teal-200 font-medium">
                  ผู้ขาย: {vendorData.name}
                </Badge>
              )}
            </div>
            {validPOs.length > 0 ? (
              <select
                value={selectedPoId}
                onChange={e => setSelectedPoId(e.target.value)}
                disabled={isSaving}
                className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]"
              >
                {validPOs.map((po: any) => {
                  const pending = poPendingCounts[po.id] || 0
                  return (
                    <option key={po.id} value={po.id}>
                      {po.poNo} — {po.vendor?.name || 'ไม่ระบุผู้ขาย'} {pending > 0 ? `(${pending} รายการรอวางบิล)` : '(วางบิลครบแล้ว)'}
                    </option>
                  )
                })}
                <option value="MANUAL">-- ผู้จัดจำหน่ายอื่นๆ / ไม่อิง PO --</option>
              </select>
            ) : (
              <div className="text-xs text-amber-600">ไม่มีรายการ PO ในเคลมนี้</div>
            )}

            {selectedPoId === 'MANUAL' && (
              <div className="pt-1.5">
                <label className="text-xs text-slate-600 block mb-1">เลือกผู้จัดจำหน่ายจากระบบ:</label>
                <select
                  value={manualVendorId || vendors[0]?.id || ''}
                  onChange={e => setManualVendorId(e.target.value)}
                  disabled={isSaving}
                  className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm"
                >
                  {vendors.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <label className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-[#0d9488] transition-colors cursor-pointer block relative">
            <input 
              type="file" 
              className="hidden" 
              accept="application/pdf, image/png, image/jpeg" 
              disabled={isSaving}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const url = URL.createObjectURL(file)
                setUploadedFile({ name: file.name, url, type: file.type, file })
              }} 
            />
            {uploadedFile ? (
              <div className="flex items-center gap-3 justify-center">
                {uploadedFile.type.startsWith('image/') ? (
                  <img src={uploadedFile.url} alt="preview" className="w-16 h-16 object-cover rounded border" />
                ) : (
                  <div className="w-16 h-16 bg-red-50 rounded border flex items-center justify-center">
                    <FileText className="w-8 h-8 text-red-500" />
                  </div>
                )}
                <div className="text-left">
                  <p className="text-sm font-medium text-[#0f172a]">{uploadedFile.name}</p>
                  <p className="text-xs text-green-600">แนบไฟล์เรียบร้อย • คลิกเพื่อเปลี่ยนไฟล์</p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 mx-auto mb-2 text-[#94a3b8]" />
                <p className="text-sm text-[#475569]">คลิกเพื่อแนบไฟล์ PDF/Image</p>
              </>
            )}
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[#475569]">เลขที่ใบวางบิล (Invoice No.)</label>
              <Input 
                className="mt-1" 
                placeholder="ใส่เลขที่จริงจากผู้จัดจำหน่าย..." 
                value={customInvoiceNo} 
                onChange={e => setCustomInvoiceNo(e.target.value)} 
                disabled={isSaving}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#475569]">ส่วนลดทั้งหมด (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                className="mt-1"
                placeholder="ใส่เปอร์เซ็นต์ส่วนลดเพื่อใช้กับทุกรายการ..."
                value={globalDiscountPct}
                onChange={e => handleGlobalDiscountChange(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3 text-slate-800">Invoice นี้ cover รายการไหนบ้าง?</h4>
            
            {/* รายการอะไหล่ */}
            <div className="border rounded-lg overflow-hidden bg-white mb-4 shadow-sm">
              <div className="bg-slate-50/80 px-3 py-2 border-b flex items-center justify-between">
                <span className="font-semibold text-xs text-slate-700 flex items-center gap-1.5">
                  🛠️ รายการอะไหล่
                </span>
                {visibleParts.length > 0 && (
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-[#0d9488] select-none">
                    <input 
                      type="checkbox" 
                      checked={isAllPartsSelected} 
                      disabled={isSaving}
                      onChange={e => {
                        const checked = e.target.checked
                        setUploadMapSelections(prev => {
                          const next = { ...prev }
                          visibleParts.forEach(p => {
                            next[p.id] = checked
                          })
                          return next
                        })
                      }} 
                      className="w-3.5 h-3.5 rounded accent-[#0d9488] cursor-pointer" 
                    />
                    เลือกทั้งหมด
                  </label>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/30">
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="text-xs">รายการ</TableHead>
                    <TableHead className="text-xs text-right w-24">ส่วนลด (%)</TableHead>
                    <TableHead className="text-xs text-right w-32">ราคา (แก้ไขได้)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleParts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center p-4 text-xs text-slate-400 italic">ไม่มีรายการอะไหล่ที่รอดำเนินการวางบิล</TableCell>
                    </TableRow>
                  ) : (
                    visibleParts.map(p => {
                      const base = getPartBaseAmt(p)
                      const disc = uploadItemDiscounts[p.id] ?? 0
                      const price = uploadItemPrices[p.id] ?? (base * (1 - disc / 100))
                      return (
                        <TableRow key={p.id} className={uploadMapSelections[p.id] ? 'bg-blue-50/30' : ''}>
                          <TableCell>
                            <input 
                              type="checkbox" 
                              checked={!!uploadMapSelections[p.id]} 
                              disabled={isSaving}
                              onChange={e => setUploadMapSelections(prev => ({ ...prev, [p.id]: e.target.checked }))} 
                              className="w-4 h-4 rounded accent-[#0d9488]" 
                            />
                          </TableCell>
                          <TableCell className="font-medium text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{p.partName}</span>
                              {currentPo && (
                                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 py-0 px-1.5 font-normal">
                                  {currentPo.poNo}
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-[#94a3b8] font-mono block mt-0.5">{p.partNo}</span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">ราคาอ้างอิง: ฿{formatCurrency(base)}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input 
                              type="number" 
                              min={0}
                              max={100}
                              className="h-8 text-xs text-right w-16 ml-auto" 
                              value={uploadItemDiscounts[p.id] ?? ''} 
                              disabled={isSaving}
                              onChange={e => {
                                const newDisc = Number(e.target.value) || 0
                                setUploadItemDiscounts(prev => ({ ...prev, [p.id]: newDisc }))
                                setUploadItemPrices(prev => ({ ...prev, [p.id]: base * (1 - newDisc / 100) }))
                              }} 
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input 
                              type="number" 
                              className="h-8 text-xs text-right w-28 ml-auto" 
                              value={price} 
                              disabled={isSaving}
                              onChange={e => {
                                const newPrice = Number(e.target.value) || 0
                                setUploadItemPrices(prev => ({ ...prev, [p.id]: newPrice }))
                                const newDisc = base > 0 ? Math.max(0, Math.round((1 - newPrice / base) * 100)) : 0
                                setUploadItemDiscounts(prev => ({ ...prev, [p.id]: newDisc }))
                              }} 
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* รายการค่าแรง */}
            <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-50/80 px-3 py-2 border-b flex items-center justify-between">
                <span className="font-semibold text-xs text-slate-700 flex items-center gap-1.5">
                  💼 รายการค่าแรง
                </span>
                {visibleLabors.length > 0 && (
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-[#0d9488] select-none">
                    <input 
                      type="checkbox" 
                      checked={isAllLaborsSelected} 
                      disabled={isSaving}
                      onChange={e => {
                        const checked = e.target.checked
                        setUploadMapSelections(prev => {
                          const next = { ...prev }
                          visibleLabors.forEach(l => {
                            next[l.id] = checked
                          })
                          return next
                        })
                      }} 
                      className="w-3.5 h-3.5 rounded accent-[#0d9488] cursor-pointer" 
                    />
                    เลือกทั้งหมด
                  </label>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/30">
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="text-xs">รายการ</TableHead>
                    <TableHead className="text-xs text-right w-24">ส่วนลด (%)</TableHead>
                    <TableHead className="text-xs text-right w-32">ราคา (แก้ไขได้)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleLabors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center p-4 text-xs text-slate-400 italic">ไม่มีรายการค่าแรงที่รอดำเนินการวางบิล</TableCell>
                    </TableRow>
                  ) : (
                    visibleLabors.map(l => {
                      const base = getLaborBaseAmt(l)
                      const disc = uploadItemDiscounts[l.id] ?? 0
                      const price = uploadItemPrices[l.id] ?? (base * (1 - disc / 100))
                      return (
                        <TableRow key={l.id} className={uploadMapSelections[l.id] ? 'bg-blue-50/30' : ''}>
                          <TableCell>
                            <input 
                              type="checkbox" 
                              checked={!!uploadMapSelections[l.id]} 
                              disabled={isSaving}
                              onChange={e => setUploadMapSelections(prev => ({ ...prev, [l.id]: e.target.checked }))} 
                              className="w-4 h-4 rounded accent-[#0d9488]" 
                            />
                          </TableCell>
                          <TableCell className="font-medium text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{l.description}</span>
                              {currentPo && (
                                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 py-0 px-1.5 font-normal">
                                  {currentPo.poNo}
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 block mt-0.5">ราคาอ้างอิง: ฿{formatCurrency(base)}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input 
                              type="number" 
                              min={0}
                              max={100}
                              className="h-8 text-xs text-right w-16 ml-auto" 
                              value={uploadItemDiscounts[l.id] ?? ''} 
                              disabled={isSaving}
                              onChange={e => {
                                const newDisc = Number(e.target.value) || 0
                                setUploadItemDiscounts(prev => ({ ...prev, [l.id]: newDisc }))
                                setUploadItemPrices(prev => ({ ...prev, [l.id]: base * (1 - newDisc / 100) }))
                              }} 
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input 
                              type="number" 
                              className="h-8 text-xs text-right w-28 ml-auto" 
                              value={price} 
                              disabled={isSaving}
                              onChange={e => {
                                const newPrice = Number(e.target.value) || 0
                                setUploadItemPrices(prev => ({ ...prev, [l.id]: newPrice }))
                                const newDisc = base > 0 ? Math.max(0, Math.round((1 - newPrice / base) * 100)) : 0
                                setUploadItemDiscounts(prev => ({ ...prev, [l.id]: newDisc }))
                              }} 
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col items-end gap-2 mt-4 p-4 bg-gray-50 rounded-lg w-full max-w-sm ml-auto">
              <div className="w-full space-y-2">
                {/* VAT Toggle */}
                <div className="flex items-center justify-between border-b pb-2 mb-2 w-full">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={invoiceIncludeVat} onChange={e => setInvoiceIncludeVat(e.target.checked)} className="w-4 h-4 rounded" disabled={isSaving} />
                    <span className="text-sm text-gray-600 font-medium">คิด VAT</span>
                  </label>
                  {invoiceIncludeVat && (
                    <div className="flex items-center gap-1">
                      <Input 
                        type="number" 
                        className="h-8 w-16 text-sm text-right" 
                        value={invoiceVatPct} 
                        onChange={e => {
                          setInvoiceVatPct(Number(e.target.value) || 0)
                          setInvoiceCustomVat('')
                        }} 
                        min={0} 
                        max={100} 
                        disabled={isSaving} 
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between w-full text-sm text-gray-500">
                  <span>มูลค่าก่อนภาษี:</span>
                  <span>฿{formatCurrency(sub)}</span>
                </div>
                {invoiceIncludeVat && (
                  <div className="flex items-center justify-between w-full text-sm text-gray-500">
                    <span>VAT {invoiceVatPct}%:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">฿</span>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 w-28 text-sm text-right font-medium"
                        value={invoiceCustomVat}
                        onChange={e => setInvoiceCustomVat(e.target.value)}
                        placeholder={calculatedVat.toFixed(2)}
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                )}
                <div className="flex justify-between w-full text-base font-bold text-blue-700 pt-2 border-t mt-1">
                  <span>รวมทั้งสิ้น:</span>
                  <span>฿{formatCurrency(sub + vat)}</span>
                </div>
                {billingPct < 100 && (
                  <div className="w-full mt-2 pt-2 border-t border-dashed">
                    <div className="flex justify-between text-sm text-amber-600">
                      <span>Vendor วางบิล {billingPct}%:</span>
                      <span>฿{formatCurrency(expectedBilling)}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">({vendorData?.name})</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>ยกเลิก</Button>
            <Button className="bg-[#0d9488] text-white" disabled={isSaving} onClick={handleSave}>
              {isSaving ? (
                <span className="flex items-center">
                  <span className="w-4 h-4 mr-1.5 border-2 border-t-white border-white/30 rounded-full animate-spin"></span>
                  อัพโหลด...
                </span>
              ) : (
                <span className="flex items-center">
                  <Save className="w-4 h-4 mr-1.5" />
                  ยืนยัน
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
