"use client"

import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { formatCurrency } from '@/lib/utils'

interface POModalProps {
  isOpen: boolean
  onClose: () => void
  claim: any
  parts: any[]
  labors: any[]
  vendors: any[]
  editPOId: string | null
  onSuccess: (savedPO: any, editMode: boolean) => void
  showToast: (msg: string) => void
  setErrorModalMsg: (msg: string) => void
}

export default function POModal({
  isOpen,
  onClose,
  claim,
  parts,
  labors,
  vendors,
  editPOId,
  onSuccess,
  showToast,
  setErrorModalMsg
}: POModalProps) {
  const [poVendorId, setPoVendorId] = useState<string>('')
  const [poVendorName, setPoVendorName] = useState<string>('')
  const [poDeliveryAddress, setPoDeliveryAddress] = useState<string>('')
  const [poModalParts, setPoModalParts] = useState<any[]>([])
  const [poModalLabors, setPoModalLabors] = useState<any[]>([])
  const [poManualItems, setPoManualItems] = useState<{ id: string; description: string; quantity: number; unitPrice: number; discountPct: number }[]>([])
  const [globalDiscountPct, setGlobalDiscountPct] = useState<string>('')
  const [poIncludeVat, setPoIncludeVat] = useState(true)
  const [poVatPct, setPoVatPct] = useState(7)
  const [isSaving, setIsSaving] = useState(false)
  
  const allPartsSelected = poModalParts.length > 0 && poModalParts.every(p => p.selected)
  const toggleSelectAllParts = (checked: boolean) => {
    setPoModalParts(poModalParts.map(p => ({ ...p, selected: checked })))
  }

  const allLaborsSelected = poModalLabors.length > 0 && poModalLabors.every(l => l.selected)
  const toggleSelectAllLabors = (checked: boolean) => {
    setPoModalLabors(poModalLabors.map(l => ({ ...l, selected: checked })))
  }

  const handleGlobalDiscountChange = (val: string) => {
    setGlobalDiscountPct(val)
    const pct = Number(val) || 0
    setPoModalParts(prev => prev.map(p => ({ ...p, discountPct: pct })))
    setPoModalLabors(prev => prev.map(l => ({ ...l, discountPct: pct })))
    setPoManualItems(prev => prev.map(m => ({ ...m, discountPct: pct })))
  }

  useEffect(() => {
    if (!isOpen) return

    if (editPOId) {
      const po = claim.purchaseOrders.find((p: any) => p.id === editPOId)
      if (po) {
        setPoVendorId(po.vendorId)
        setPoVendorName(po.vendor?.name || '')
        setPoDeliveryAddress(po.deliveryAddress || '')
        setPoModalParts(parts.map((p: any) => {
          const existingPoItem = po.items.find((pi: any) => pi.partNo === p.partNo || pi.description === p.partName)
          if (existingPoItem) {
            const originalPrice = Number(p.priceApprove) || 0
            const poUnitPrice = Number(existingPoItem.unitPrice) || 0
            let discountPct = existingPoItem.discountPct || 0
            if (!discountPct && originalPrice > 0) {
              discountPct = Math.max(0, Math.round((1 - poUnitPrice / originalPrice) * 100))
            }
            return { 
              ...p, 
              selected: true, 
              partName: existingPoItem.description, 
              quantity: existingPoItem.quantity, 
              priceApprove: originalPrice, 
              discountPct 
            }
          }
          return { ...p, selected: false, discountPct: p.discountPct || 0 }
        }))
        setPoModalLabors(labors.map((l: any) => {
          const existingPoItem = po.items.find((pi: any) => pi.description === `[ค่าแรง] ${l.description}`)
          if (existingPoItem) {
            const originalPrice = Number(l.priceApprove) || 0
            const poUnitPrice = Number(existingPoItem.unitPrice) || 0
            let discountPct = existingPoItem.discountPct || 0
            if (!discountPct && originalPrice > 0) {
              discountPct = Math.max(0, Math.round((1 - poUnitPrice / originalPrice) * 100))
            }
            return { ...l, selected: true, description: existingPoItem.description.replace('[ค่าแรง] ', ''), priceApprove: originalPrice, discountPct }
          }
          return { ...l, selected: false, discountPct: l.discountPct || 0 }
        }))
        const manuals = po.items.filter((pi: any) => {
          const isPart = parts.some(p => pi.partNo === p.partNo || pi.description === p.partName)
          const isLabor = labors.some(l => pi.description === `[ค่าแรง] ${l.description}`)
          return !isPart && !isLabor
        }).map((pi: any) => ({
          id: pi.id || `manual-${Math.random()}`,
          description: pi.description,
          quantity: pi.quantity,
          unitPrice: pi.unitPrice,
          discountPct: pi.discountPct || 0
        }))
        setPoManualItems(manuals)
        setPoIncludeVat(po.includeVat ?? true)
        setPoVatPct(po.vatPct ?? 7)

        // Reconstruct global discount if all PO items share the same discountPct
        const allPartDiscounts = parts.map((p: any) => {
          const pi = po.items.find((x: any) => x.partNo === p.partNo || x.description === p.partName)
          if (!pi) return null
          const originalPrice = Number(p.priceApprove) || 0
          const poUnitPrice = Number(pi.unitPrice) || 0
          return pi.discountPct || (originalPrice > 0 ? Math.max(0, Math.round((1 - poUnitPrice / originalPrice) * 100)) : 0)
        }).filter((d: any): d is number => d !== null)

        const allLaborDiscounts = labors.map((l: any) => {
          const pi = po.items.find((x: any) => x.description === `[ค่าแรง] ${l.description}`)
          if (!pi) return null
          const originalPrice = Number(l.priceApprove) || 0
          const poUnitPrice = Number(pi.unitPrice) || 0
          return pi.discountPct || (originalPrice > 0 ? Math.max(0, Math.round((1 - poUnitPrice / originalPrice) * 100)) : 0)
        }).filter((d: any): d is number => d !== null)

        const allDiscounts = [...allPartDiscounts, ...allLaborDiscounts]
        if (allDiscounts.length > 0 && allDiscounts.every(d => d === allDiscounts[0])) {
          setGlobalDiscountPct(String(allDiscounts[0]))
        } else {
          setGlobalDiscountPct('')
        }
      }
    } else {
      if (vendors.length > 0) {
        setPoVendorId(vendors[0].id)
        setPoVendorName(vendors[0].name)
      } else {
        setPoVendorId('')
        setPoVendorName('')
      }
      setPoDeliveryAddress(claim.garage?.name ? `${claim.garage.name}\n${claim.garage.address || ''} ${claim.garage.province || ''}`.trim() : '')
      setPoModalParts(parts.map(p => ({ ...p, selected: p.status === 'approved', discountPct: p.discountPct || 0 })))
      setPoModalLabors(labors.map(l => ({ ...l, selected: false, discountPct: l.discountPct || 0 })))
      setPoManualItems([])
      setPoIncludeVat(true)
      setPoVatPct(7)
      setGlobalDiscountPct('')
    }
  }, [isOpen, editPOId, claim, parts, labors, vendors])

  if (!isOpen) return null

  const poPartsTot = poModalParts.filter(p => p.selected).reduce((sum, p) => {
    const originalPrice = Number(p.priceApprove) || 0
    const qty = Number(p.quantity) || 1
    const discount = Number(p.discountPct) || 0
    const discountedPrice = originalPrice * (1 - discount / 100)
    return sum + (discountedPrice * qty)
  }, 0)

  const poLaborsTot = poModalLabors.filter(l => l.selected).reduce((sum, l) => {
    const originalPrice = Number(l.priceApprove) || 0
    const discount = Number(l.discountPct) || 0
    const discountedPrice = originalPrice * (1 - discount / 100)
    return sum + discountedPrice
  }, 0)

  const poManualTot = poManualItems.reduce((sum, m) => {
    const originalPrice = Number(m.unitPrice) || 0
    const qty = Number(m.quantity) || 1
    const discount = Number(m.discountPct) || 0
    const discountedPrice = originalPrice * (1 - discount / 100)
    return sum + (discountedPrice * qty)
  }, 0)

  const poTot = poPartsTot + poLaborsTot + poManualTot
  const vatAmt = poIncludeVat ? Math.round(poTot * (poVatPct / 100)) : 0

  const handleSave = async () => {
    const selectedParts = poModalParts.filter(p => p.selected)
    const selectedLabors = poModalLabors.filter(l => l.selected)
    if (selectedParts.length === 0 && selectedLabors.length === 0 && poManualItems.length === 0) {
      showToast('กรุณาเลือกรายการอย่างน้อย 1 รายการ')
      return
    }
    if (!poDeliveryAddress || !poDeliveryAddress.trim()) {
      showToast('⚠️ กรุณาระบุที่อยู่สำหรับจัดส่ง')
      return
    }
    setIsSaving(true)
    const poNo = editPOId ? claim.purchaseOrders.find((p: any) => p.id === editPOId)?.poNo : undefined

    const partItems = selectedParts.map(p => {
      const originalPrice = Number(p.priceApprove) || 0
      const discount = Number(p.discountPct) || 0
      const discountedPrice = originalPrice * (1 - discount / 100)
      return {
        partNo: p.partNo,
        description: p.partName,
        quantity: Number(p.quantity) || 1,
        unitPrice: discountedPrice,
        discountPct: discount,
        totalPrice: discountedPrice * (Number(p.quantity) || 1)
      }
    })
    const laborItems = selectedLabors.map(l => {
      const originalPrice = Number(l.priceApprove) || 0
      const discount = Number(l.discountPct) || 0
      const discountedPrice = originalPrice * (1 - discount / 100)
      return {
        partNo: '',
        description: `[ค่าแรง] ${l.description}`,
        quantity: 1,
        unitPrice: discountedPrice,
        discountPct: discount,
        totalPrice: discountedPrice
      }
    })
    const manualItems = poManualItems.filter(m => m.description.trim()).map(m => {
      const originalPrice = Number(m.unitPrice) || 0
      const discount = Number(m.discountPct) || 0
      const discountedPrice = originalPrice * (1 - discount / 100)
      return {
        partNo: '',
        description: m.description,
        quantity: Number(m.quantity) || 1,
        unitPrice: discountedPrice,
        discountPct: discount,
        totalPrice: discountedPrice * (Number(m.quantity) || 1)
      }
    })

    const payload = {
      poNo,
      vendorId: poVendorId,
      deliveryAddress: poDeliveryAddress,
      includeVat: poIncludeVat,
      vatPct: poIncludeVat ? poVatPct : 0,
      items: [...partItems, ...laborItems, ...manualItems]
    }

    try {
      const url = editPOId ? `/api/claims/${claim.id}/pos/${editPOId}` : `/api/claims/${claim.id}/pos`
      const method = editPOId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to save PO')
      }
      const savedPO = await res.json()
      if (!savedPO.vendor) savedPO.vendor = { id: poVendorId, name: poVendorName }

      onSuccess(savedPO, !!editPOId)
      onClose()
    } catch (err: any) {
      setErrorModalMsg(`เกิดข้อผิดพลาดในการ${editPOId ? 'แก้ไข' : 'สร้าง'} PO: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-[#f8faff]">
          <h3 className="font-semibold text-lg text-[#0f172a] flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            {editPOId ? 'แก้ไขใบสั่งซื้อ' : 'สร้างใบสั่งซื้อ'} (PO)
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-[#94a3b8] hover:text-[#0f172a]" disabled={isSaving}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#475569]">เลือกผู้จัดจำหน่าย (Vendor)</label>
                <SearchableSelect
                  options={vendors.map(v => ({
                    value: v.id,
                    label: `${v.name} (${v.vendorType === 'PARTS' ? 'ผู้จำหน่ายอะไหล่' : 'อู่'})`
                  }))}
                  value={poVendorId}
                  onChange={(val) => {
                    setPoVendorId(val)
                    const selected = vendors.find(v => v.id === val)
                    setPoVendorName(selected ? selected.name : '')
                  }}
                  placeholder="เลือกผู้จัดจำหน่าย..."
                />
                <div className="mt-3">
                  <label className="text-sm font-medium text-[#475569]">ส่วนลดทั้งหมด (%)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="ใส่เปอร์เซ็นต์ส่วนลดเพื่อใช้กับทุกรายการ..."
                    value={globalDiscountPct}
                    onChange={e => handleGlobalDiscountChange(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#475569]">ที่อยู่สำหรับจัดส่ง (ใบส่งของ) <span className="text-rose-500">*</span></label>
                <SearchableSelect
                  options={vendors.map(v => ({
                    value: v.id,
                    label: `${v.name} (${v.province || 'ไม่ระบุจังหวัด'})`
                  }))}
                  value=""
                  onChange={(val) => {
                    const selected = vendors.find(v => v.id === val)
                    if (selected) {
                      setPoDeliveryAddress(`${selected.name}\n${selected.address || ''} ${selected.province || ''}`.trim())
                    }
                  }}
                  placeholder="ค้นหาและเลือกที่อยู่อู่/คู่ค้า..."
                />
                <textarea
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  rows={2}
                  value={poDeliveryAddress}
                  onChange={e => setPoDeliveryAddress(e.target.value)}
                  placeholder="พิมพ์ชื่ออู่ / ศูนย์บริการ / ที่อยู่จัดส่งเพิ่มเติม"
                />
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden mt-4">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-10">
                      <input 
                        type="checkbox" 
                        checked={allPartsSelected} 
                        onChange={e => toggleSelectAllParts(e.target.checked)} 
                        className="w-4 h-4 cursor-pointer" 
                      />
                    </TableHead>
                    <TableHead>รายการอะไหล่</TableHead>
                    <TableHead className="w-20 text-center">จำนวน</TableHead>
                    <TableHead className="w-28 text-right">ราคา/หน่วย</TableHead>
                    <TableHead className="w-24 text-right">ส่วนลด (%)</TableHead>
                    <TableHead className="w-28 text-right">รวม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poModalParts.map((p, i) => {
                    const originalPrice = Number(p.priceApprove) || 0
                    const qty = Number(p.quantity) || 1
                    const discount = Number(p.discountPct) || 0
                    const rowTotal = originalPrice * qty * (1 - discount / 100)
                    return (
                      <TableRow key={p.id}>
                        <TableCell><input type="checkbox" checked={p.selected} onChange={e => { const n = [...poModalParts]; n[i].selected = e.target.checked; setPoModalParts(n) }} className="w-4 h-4" /></TableCell>
                        <TableCell><Input className="h-8 text-sm" value={p.partName} onChange={e => { const n = [...poModalParts]; n[i].partName = e.target.value; setPoModalParts(n) }} /></TableCell>
                        <TableCell><Input type="number" className="h-8 text-sm text-center" value={p.quantity || ''} onChange={e => { const n = [...poModalParts]; n[i].quantity = Number(e.target.value); setPoModalParts(n) }} /></TableCell>
                        <TableCell><Input type="number" className="h-8 text-sm text-right" value={p.priceApprove || ''} onChange={e => { const n = [...poModalParts]; n[i].priceApprove = Number(e.target.value); setPoModalParts(n) }} /></TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            min={0} 
                            max={100} 
                            className="h-8 text-sm text-right" 
                            value={p.discountPct ?? ''} 
                            onChange={e => { 
                              const n = [...poModalParts]
                              n[i].discountPct = Number(e.target.value) || 0
                              setPoModalParts(n) 
                            }} 
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm pt-3">฿{formatCurrency(rowTotal)}</TableCell>
                      </TableRow>
                    )
                  })}
                  {poModalParts.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-4 text-gray-500">ไม่มีรายการอะไหล่</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Labor items */}
            <div className="border rounded-lg overflow-hidden mt-4">
              <div className="bg-amber-50 px-4 py-2 border-b">
                <h4 className="text-sm font-semibold text-amber-800">ค่าแรง</h4>
              </div>
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-10">
                      <input 
                        type="checkbox" 
                        checked={allLaborsSelected} 
                        onChange={e => toggleSelectAllLabors(e.target.checked)} 
                        className="w-4 h-4 cursor-pointer" 
                      />
                    </TableHead>
                    <TableHead>รายการค่าแรง</TableHead>
                    <TableHead className="w-28 text-right">ราคา</TableHead>
                    <TableHead className="w-24 text-right">ส่วนลด (%)</TableHead>
                    <TableHead className="w-28 text-right">รวม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poModalLabors.map((l: any, i: number) => {
                    const originalPrice = Number(l.priceApprove) || 0
                    const discount = Number(l.discountPct) || 0
                    const rowTotal = originalPrice * (1 - discount / 100)
                    return (
                      <TableRow key={l.id}>
                        <TableCell><input type="checkbox" checked={l.selected} onChange={e => { const n = [...poModalLabors]; n[i].selected = e.target.checked; setPoModalLabors(n) }} className="w-4 h-4" /></TableCell>
                        <TableCell><Input className="h-8 text-sm" value={l.description} onChange={e => { const n = [...poModalLabors]; n[i].description = e.target.value; setPoModalLabors(n) }} /></TableCell>
                        <TableCell><Input type="number" className="h-8 text-sm text-right w-28 ml-auto" value={l.priceApprove || ''} onChange={e => { const n = [...poModalLabors]; n[i].priceApprove = Number(e.target.value); setPoModalLabors(n) }} /></TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            min={0} 
                            max={100} 
                            className="h-8 text-sm text-right w-20 ml-auto" 
                            value={l.discountPct ?? ''} 
                            onChange={e => { 
                              const n = [...poModalLabors]
                              n[i].discountPct = Number(e.target.value) || 0
                              setPoModalLabors(n) 
                            }} 
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm pt-3">฿{formatCurrency(rowTotal)}</TableCell>
                      </TableRow>
                    )
                  })}
                  {poModalLabors.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-4 text-gray-500">ไม่มีรายการค่าแรง</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Manual Items */}
            <div className="border rounded-lg overflow-hidden mt-4">
              <div className="bg-green-50 px-4 py-2 border-b flex items-center justify-between">
                <h4 className="text-sm font-semibold text-green-800">รายการเพิ่มเติม (Manual)</h4>
                <Button variant="outline" size="sm" className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-100" onClick={() => setPoManualItems([...poManualItems, { id: `manual-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, discountPct: Number(globalDiscountPct) || 0 }])}>
                  <Plus className="w-3 h-3 mr-1" />เพิ่มรายการ
                </Button>
              </div>
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>รายการ</TableHead>
                    <TableHead className="w-20 text-center">จำนวน</TableHead>
                    <TableHead className="w-28 text-right">ราคา/หน่วย</TableHead>
                    <TableHead className="w-24 text-right">ส่วนลด (%)</TableHead>
                    <TableHead className="w-28 text-right">รวม</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poManualItems.map((m, i) => {
                    const originalPrice = Number(m.unitPrice) || 0
                    const qty = Number(m.quantity) || 1
                    const discount = Number(m.discountPct) || 0
                    const rowTotal = originalPrice * qty * (1 - discount / 100)
                    return (
                      <TableRow key={m.id}>
                        <TableCell><Input className="h-8 text-sm" placeholder="ชื่อรายการ เช่น ค่าขนส่ง" value={m.description} onChange={e => { const n = [...poManualItems]; n[i].description = e.target.value; setPoManualItems(n) }} /></TableCell>
                        <TableCell><Input type="number" className="h-8 text-sm text-center" value={m.quantity || ''} onChange={e => { const n = [...poManualItems]; n[i].quantity = Number(e.target.value); setPoManualItems(n) }} /></TableCell>
                        <TableCell><Input type="number" className="h-8 text-sm text-right" value={m.unitPrice || ''} onChange={e => { const n = [...poManualItems]; n[i].unitPrice = Number(e.target.value); setPoManualItems(n) }} /></TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            min={0} 
                            max={100} 
                            className="h-8 text-sm text-right" 
                            value={m.discountPct ?? ''} 
                            onChange={e => { 
                              const n = [...poManualItems]
                              n[i].discountPct = Number(e.target.value) || 0
                              setPoManualItems(n) 
                            }} 
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm pt-3">฿{formatCurrency(rowTotal)}</TableCell>
                        <TableCell><button onClick={() => setPoManualItems(poManualItems.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></TableCell>
                      </TableRow>
                    )
                  })}
                  {poManualItems.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-4 text-gray-400 text-sm">ยังไม่มีรายการเพิ่มเติม — กดปุ่ม "เพิ่มรายการ" ด้านบน</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <div className="flex flex-col items-end gap-2 w-72 bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between w-full text-sm text-gray-500">
                  <span>ยอดรวมก่อน VAT:</span><span>฿{formatCurrency(poTot)}</span>
                </div>
                {/* VAT Toggle */}
                <div className="flex items-center justify-between w-full">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={poIncludeVat} onChange={e => setPoIncludeVat(e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-sm text-gray-600">รวม VAT</span>
                  </label>
                  {poIncludeVat && (
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-7 w-16 text-sm text-right" value={poVatPct} onChange={e => setPoVatPct(Number(e.target.value) || 0)} />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  )}
                </div>
                {poIncludeVat && (
                  <div className="flex justify-between w-full text-sm text-gray-500">
                    <span>VAT {poVatPct}%:</span><span>฿{formatCurrency(vatAmt)}</span>
                  </div>
                )}
                <div className="flex justify-between w-full text-base font-bold text-blue-700 pt-2 border-t mt-1">
                  <span>ยอดรวมทั้งสิ้น:</span><span>฿{formatCurrency(poTot + vatAmt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>ยกเลิก</Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'กำลังบันทึก...' : editPOId ? 'บันทึกการแก้ไข PO' : 'ยืนยันสร้าง PO'}
          </Button>
        </div>
      </div>
    </div>
  )
}
