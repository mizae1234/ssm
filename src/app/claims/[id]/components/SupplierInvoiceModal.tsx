"use client"

import React, { useState, useEffect } from 'react'
import { X, Upload, Save, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { uploadToR2 } from '@/lib/upload'
import { formatCurrency } from '@/lib/utils'

interface SupplierInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  claim: any
  parts: any[]
  labors: any[]
  vendors: any[]
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

  // Helpers defined at top of body so they are available to useEffect
  const globalPoItems = claim?.purchaseOrders?.filter((po: any) => po.status !== 'CANCELLED').flatMap((po: any) => po.items.map((item: any) => ({ ...item, poId: po.id, poNo: po.poNo, poStatus: po.status }))) || []
  
  const getPartBaseAmt = (p: any) => {
    const poi = globalPoItems.find((x: any) => x.partNo === p.partNo)
    return poi ? (poi.unitPrice * (poi.quantity || 1)) : (p.priceApprove * p.quantity)
  }

  const getLaborBaseAmt = (l: any) => {
    const pol = globalPoItems.find((x: any) => x.description?.includes(l.description))
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

  useEffect(() => {
    if (!isOpen) return
    setUploadedFile(null)
    
    const initialSelections: Record<string, boolean> = {}
    const initialPrices: Record<string, number> = {}
    const initialDiscounts: Record<string, number> = {}

    const activeParts = parts
      .filter(p => p.paymentStatus !== 'INVOICED' && p.paymentStatus !== 'PAID')
      .filter(p => globalPoItems.some((x: any) => x.partNo === p.partNo))
    const activeLabors = labors
      .filter(l => l.paymentStatus !== 'INVOICED' && l.paymentStatus !== 'PAID')
      .filter(l => globalPoItems.some((x: any) => x.description?.includes(l.description)))

    activeParts.forEach(p => {
      initialSelections[p.id] = true
      const poi = globalPoItems.find((x: any) => x.partNo === p.partNo)
      const base = poi ? (poi.unitPrice * (poi.quantity || 1)) : (p.priceApprove * p.quantity)
      const disc = poi ? 0 : (p.discountPct || 0)
      initialDiscounts[p.id] = disc
      initialPrices[p.id] = base * (1 - disc / 100)
    })

    activeLabors.forEach(l => {
      initialSelections[l.id] = true
      const pol = globalPoItems.find((x: any) => x.description?.includes(l.description))
      const base = pol ? pol.unitPrice : l.priceApprove
      const disc = pol ? 0 : (l.discountPct || 0)
      initialDiscounts[l.id] = disc
      initialPrices[l.id] = base * (1 - disc / 100)
    })

    setUploadMapSelections(initialSelections)
    setUploadItemPrices(initialPrices)
    setUploadItemDiscounts(initialDiscounts)
    setCustomInvoiceNo('')
    setInvoiceIncludeVat(true)
    setInvoiceVatPct(7)
    setInvoiceCustomVat('')
    setGlobalDiscountPct('')
  }, [isOpen, parts, labors, claim])

  if (!isOpen) return null
  const visibleParts = parts
    .filter(p => p.paymentStatus !== 'INVOICED' && p.paymentStatus !== 'PAID')
    .filter(p => globalPoItems.some((x: any) => x.partNo === p.partNo))
  const visibleLabors = labors
    .filter(l => l.paymentStatus !== 'INVOICED' && l.paymentStatus !== 'PAID')
    .filter(l => globalPoItems.some((x: any) => x.description?.includes(l.description)))


  const sub = parts.filter(p => uploadMapSelections[p.id]).reduce((s, p) => s + getPartPrice(p), 0) + 
              labors.filter(l => uploadMapSelections[l.id]).reduce((s, l) => s + getLaborPrice(l), 0)
  const calculatedVat = invoiceIncludeVat ? Math.round(sub * (invoiceVatPct / 100) * 100) / 100 : 0
  const vat = invoiceIncludeVat ? (invoiceCustomVat !== '' ? Number(invoiceCustomVat) : calculatedVat) : 0
  const validPOs = claim.purchaseOrders?.filter((po: any) => po.status !== 'CANCELLED') || []
  const vendorData = validPOs[0]?.vendorId ? vendors.find((v: any) => v.id === validPOs[0].vendorId) : vendors[0]
  const billingPct = vendorData?.billingPct ?? 100
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
      const firstVendorId = validPOs[0]?.vendorId || vendors[0]?.id || claim.garageId || 'ven-p01'

      const partItems = selParts.map(p => {
        const price = getPartPrice(p)
        const unitPrice = price / p.quantity
        const poItem = validPOs.flatMap((po: any) => po.items).find((pi: any) => pi.partNo === p.partNo)
        return {
          poItemId: poItem?.id || validPOs[0]?.items?.[0]?.id,
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
        const poLabor = validPOs.flatMap((po: any) => po.items).find((pi: any) => pi.description?.includes(l.description))
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
          vendorId: firstVendorId,
          invoiceNo,
          items: allItems,
          pdfUrl: pdfUrlToSave,
          vatAmount: vat,
          laborIds: selLabors.map(l => l.id)
        })
      })

      if (!res.ok) {
        throw new Error('เกิดข้อผิดพลาดในการบันทึกข้อมูลบางส่วน')
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
                            {p.partName} <span className="text-[10px] text-[#94a3b8] font-mono block mt-0.5">{p.partNo}</span>
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
                            {l.description}
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
