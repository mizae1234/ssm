"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Filter, Package, AlertTriangle, ArrowRight, History, Settings2, Edit, Download } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { PartMaster } from '@/lib/types'
import { SkeletonTableRows } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export default function PartsMasterPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterSource, setFilterSource] = useState<'ALL' | 'AUTO' | 'MANUAL'>('ALL')
  const [showNoPeakOnly, setShowNoPeakOnly] = useState(false)
  const [parts, setParts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalParts, setTotalParts] = useState(0)
  const itemsPerPage = 50

  // Edit / Create State
  const [selectedPart, setSelectedPart] = useState<any | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [reloadTrigger, setReloadTrigger] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch data with pagination
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(currentPage),
      limit: String(itemsPerPage),
    })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (showNoPeakOnly) params.set('noPeak', 'true')
    
    fetch(`/api/parts-master?${params}`).then(res => res.json()).then(data => {
      setParts(data.data || [])
      setTotalParts(data.total || 0)
      setTotalPages(data.totalPages || 1)
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [currentPage, debouncedSearch, showNoPeakOnly, reloadTrigger])

  const filteredParts = filterSource === 'ALL' ? parts : parts.filter(p => p.source === filterSource)

  // Stats from current page (approximate)
  const autoParts = parts.filter(p => p.source === 'AUTO').length
  const missingPrice = parts.filter(p => !p.standardPrice).length

  // Edit handlers
  const handleEditClick = (p: any) => {
    setSelectedPart({
      ...p,
      standardPrice: p.standardPrice ?? '',
      purchasePrice: p.purchasePrice ?? '',
      description: p.description ?? '',
      peakCode: p.peakCode ?? '',
      stock: p.stock ?? 0,
    })
    setIsNew(false)
    setIsEditOpen(true)
  }

  const handleAddNew = () => {
    setSelectedPart({
      partNo: '',
      partName: '',
      category: '',
      unit: 'ชิ้น',
      standardPrice: '',
      purchasePrice: '',
      description: '',
      peakCode: '',
      stock: 0,
      isActive: true,
    })
    setIsNew(true)
    setIsEditOpen(true)
  }

  const handleSave = async () => {
    if (!selectedPart.partNo || !selectedPart.partName) {
      showToast('⚠️ กรุณากรอกรหัสอะไหล่และชื่ออะไหล่')
      return
    }

    try {
      setIsSaving(true)
      const url = isNew ? '/api/parts-master' : `/api/parts-master/${selectedPart.id}`
      const method = isNew ? 'POST' : 'PUT'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedPart,
          standardPrice: selectedPart.standardPrice === '' ? null : Number(selectedPart.standardPrice),
          purchasePrice: selectedPart.purchasePrice === '' ? null : Number(selectedPart.purchasePrice),
          stock: Number(selectedPart.stock) || 0,
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'บันทึกไม่สำเร็จ')
      }

      showToast(isNew ? 'เพิ่มอะไหล่ใหม่เรียบร้อยแล้ว' : 'บันทึกการแก้ไขเรียบร้อยแล้ว')
      setIsEditOpen(false)
      setReloadTrigger(prev => prev + 1)
    } catch (err: any) {
      console.error(err)
      showToast(`❌ เกิดข้อผิดพลาด: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleExportExcel = async () => {
    try {
      showToast('กำลังดาวน์โหลดข้อมูลอะไหล่...')
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      params.set('export', 'true')
      
      const res = await fetch(`/api/parts-master?${params}`)
      if (!res.ok) throw new Error('เรียกข้อมูลไม่สำเร็จ')
      const data = await res.json()
      
      const XLSX = await import('xlsx')
      
      const excelRows = data.map((p: any) => ({
        'รหัสอะไหล่ (Part No.)': p.partNo,
        'ชื่ออะไหล่ (Part Name)': p.partName,
        'หมวดหมู่ (Category)': p.category || '',
        'หน่วยนับ (Unit)': p.unit || 'ชิ้น',
        'ราคากลาง (Standard Price)': p.standardPrice || 0,
        'ราคาซื้อ (Purchase Price)': p.purchasePrice || 0,
        'สต็อกคงเหลือ (Stock)': p.stock || 0,
        'รหัสสินค้า PEAK': p.peakCode || '',
        'สถานะ': p.isActive ? 'Active' : 'Inactive',
        'จำนวนครั้งที่เคลม': p.usageCount || 0,
        'แหล่งที่มา (Source)': p.source,
        'รายละเอียดอะไหล่': p.description || ''
      }))
      
      const worksheet = XLSX.utils.json_to_sheet(excelRows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Parts Master')
      
      XLSX.writeFile(workbook, `ssm_parts_master_${new Date().toISOString().split('T')[0]}.xlsx`)
      showToast('ส่งออกข้อมูล Excel เรียบร้อยแล้ว')
    } catch (err: any) {
      console.error(err)
      showToast(`❌ เกิดข้อผิดพลาดในการส่งออก: ${err.message}`)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 text-white px-6 py-3 rounded-xl shadow-2xl z-[100] animate-in slide-in-from-top-4 font-medium flex items-center gap-2 ${toast.includes('❌') || toast.includes('⚠️') ? 'bg-red-600' : 'bg-green-600'}`}>
          {!toast.includes('❌') && !toast.includes('⚠️') && !toast.includes('✅') && '✅ '}
          <span>{toast}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Parts Master</h1>
          <p className="text-sm text-[#94a3b8] mt-1">ฐานข้อมูลอะไหล่กลาง สร้างอัตโนมัติจากประวัติการเคลม</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-gray-200" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button className="bg-[#0d9488] hover:bg-[#0f766e]" onClick={handleAddNew}>
            <Plus className="w-4 h-4 mr-2" />
            เพิ่มอะไหล่ใหม่
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Package className="w-6 h-6 text-[#0d9488]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#475569]">อะไหล่ทั้งหมด</p>
              <h3 className="text-2xl font-bold text-[#0f172a]">{totalParts} <span className="text-sm font-normal text-[#94a3b8]">รายการ</span></h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Settings2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#475569]">สร้างจาก Claim อัตโนมัติ</p>
              <h3 className="text-2xl font-bold text-[#0f172a]">{autoParts} <span className="text-sm font-normal text-[#94a3b8]">รายการ</span></h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#475569]">ยังไม่มีราคากลาง</p>
              <h3 className="text-2xl font-bold text-[#0f172a]">{missingPrice} <span className="text-sm font-normal text-[#94a3b8]">รายการ</span></h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-white rounded-t-xl">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="ค้นหารหัส หรือ ชื่ออะไหล่..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-gray-50 border-transparent focus:bg-white transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant={filterSource === 'ALL' ? 'default' : 'outline'} onClick={() => setFilterSource('ALL')} className={cn("h-9", filterSource === 'ALL' ? "bg-[#0d9488]" : "")}>ทั้งหมด</Button>
              <Button variant={filterSource === 'AUTO' ? 'default' : 'outline'} onClick={() => setFilterSource('AUTO')} className={cn("h-9", filterSource === 'AUTO' ? "bg-emerald-600 hover:bg-emerald-700" : "")}>สร้างออโต้</Button>
              <Button variant={filterSource === 'MANUAL' ? 'default' : 'outline'} onClick={() => setFilterSource('MANUAL')} className={cn("h-9", filterSource === 'MANUAL' ? "bg-gray-600 hover:bg-gray-700" : "")}>คีย์มือ</Button>
            </div>
            <div className="flex items-center gap-2 border-l pl-4 border-gray-100">
              <Button
                variant={showNoPeakOnly ? 'default' : 'outline'}
                onClick={() => {
                  setShowNoPeakOnly(!showNoPeakOnly)
                  setCurrentPage(1)
                }}
                className={cn("h-9", showNoPeakOnly ? "bg-amber-600 hover:bg-amber-700 text-white" : "")}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                ยังไม่มีรหัส PEAK
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[#f8faff]">
                  <th className="text-left p-4 font-semibold text-[#475569]">Part No.</th>
                  <th className="text-left p-4 font-semibold text-[#475569]">ชื่ออะไหล่</th>
                  <th className="text-left p-4 font-semibold text-[#475569]">หมวดหมู่</th>
                  <th className="text-right p-4 font-semibold text-[#475569]">ราคากลาง</th>
                  <th className="text-center p-4 font-semibold text-[#475569]">คงเหลือ (Stock)</th>
                  <th className="text-center p-4 font-semibold text-[#475569]">Vendor (ราคา)</th>
                  <th className="text-center p-4 font-semibold text-[#475569]">ใช้ไป (Claim)</th>
                  <th className="text-center p-4 font-semibold text-[#475569]">PEAK</th>
                  <th className="text-center p-4 font-semibold text-[#475569]">Source</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonTableRows rows={10} cols={10} />
                ) : filteredParts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-[#94a3b8]">ไม่พบข้อมูลอะไหล่ที่ค้นหา</td>
                  </tr>
                ) : (
                  filteredParts.map((p) => (
                    <tr 
                      key={p.id} 
                      className="border-b border-gray-50 hover:bg-[#f8faff] transition-colors group cursor-pointer"
                      onClick={() => router.push(`/parts-master/${p.id}`)}
                    >
                      <td className="p-4 font-mono text-[#0f172a]">{p.partNo}</td>
                      <td className="p-4">
                        <div className="font-medium text-[#0f172a]">{p.partName}</div>
                        {p.partNameAlt.length > 0 && (
                          <div className="text-xs text-[#94a3b8] mt-0.5 line-clamp-1">
                            สะกดอื่น: {p.partNameAlt.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-[#475569]">{p.category || '-'}</td>
                      <td className="p-4 text-right">
                        {p.standardPrice ? (
                          <span className="font-semibold text-[#0f172a]">{formatCurrency(p.standardPrice)}</span>
                        ) : (
                          <span className="text-amber-500 text-xs flex items-center justify-end gap-1"><AlertTriangle className="w-3 h-3"/> ยังไม่มี</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="outline" className={cn("bg-white font-mono font-semibold", (p.stock || 0) > 0 ? "text-emerald-600 border-emerald-200 bg-emerald-50/50" : "text-gray-400")}>
                          {p.stock ?? 0} {p.unit || 'ชิ้น'}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="outline" className="bg-white">
                          {p.vendorPrices?.length || 0} เจ้า
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-[#0f172a]">
                          <History className="w-3.5 h-3.5 text-[#94a3b8]" />
                          {p.usageCount}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {p.peakCode ? (
                          <span className="text-lg">✅</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {p.source === 'AUTO' ? (
                          <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-none shadow-none text-[10px]">AUTO</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-200 border-none shadow-none text-[10px]">MANUAL</Badge>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/parts-master/${p.id}`)
                          }}
                        >
                          <Edit className="w-4 h-4 text-[#0d9488]" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {parts.length > 0 && (
            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-[#475569] bg-white rounded-b-xl">
              <div>แสดงหน้า {currentPage} จาก {totalPages} ({totalParts} รายการ)</div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>ก่อนหน้า</Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  return (
                    <Button key={pageNum} variant="outline" size="sm" className={currentPage === pageNum ? 'bg-[#f8faff] text-[#0d9488] border-[#0d9488]' : ''} onClick={() => setCurrentPage(pageNum)}>{pageNum}</Button>
                  )
                })}
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>ถัดไป</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl bg-white border rounded-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#0f172a]">
              {isNew ? 'เพิ่มอะไหล่ใหม่' : `แก้ไขข้อมูลอะไหล่: ${selectedPart?.partNo}`}
            </DialogTitle>
            <DialogDescription className="text-sm text-[#64748b]">
              {isNew ? 'กรอกรายละเอียดอะไหล่ใหม่ลงในระบบ' : 'ปรับปรุงข้อมูลรายละเอียดราคากลาง, สต็อก และรหัสเชื่อมต่อบัญชี'}
            </DialogDescription>
          </DialogHeader>

          {selectedPart && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569]">รหัสอะไหล่ (Part No.) <span className="text-red-500">*</span></label>
                <Input
                  placeholder="เช่น 12345-ABC"
                  value={selectedPart.partNo || ''}
                  onChange={e => setSelectedPart({ ...selectedPart, partNo: e.target.value })}
                  className="border-gray-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569]">ชื่ออะไหล่ (Part Name) <span className="text-red-500">*</span></label>
                <Input
                  placeholder="เช่น กันชนหน้า"
                  value={selectedPart.partName || ''}
                  onChange={e => setSelectedPart({ ...selectedPart, partName: e.target.value })}
                  className="border-gray-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569]">หมวดหมู่ (Category)</label>
                <Input
                  placeholder="เช่น กันชน, ไฟ, ตัวถัง"
                  value={selectedPart.category || ''}
                  onChange={e => setSelectedPart({ ...selectedPart, category: e.target.value })}
                  className="border-gray-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569]">หน่วยนับ (Unit)</label>
                <Input
                  placeholder="ชิ้น, ชุด, ตัว"
                  value={selectedPart.unit || 'ชิ้น'}
                  onChange={e => setSelectedPart({ ...selectedPart, unit: e.target.value })}
                  className="border-gray-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569]">ราคากลาง (Standard Price)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={selectedPart.standardPrice ?? ''}
                  onChange={e => setSelectedPart({ ...selectedPart, standardPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="border-gray-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569]">ราคาซื้อ (Purchase Price)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={selectedPart.purchasePrice ?? ''}
                  onChange={e => setSelectedPart({ ...selectedPart, purchasePrice: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="border-gray-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569]">รหัสสินค้าใน PEAK (PEAK Product Code)</label>
                <Input
                  placeholder="เช่น P00001"
                  value={selectedPart.peakCode || ''}
                  onChange={e => setSelectedPart({ ...selectedPart, peakCode: e.target.value })}
                  className="border-gray-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#475569]">จำนวนสต็อกคงเหลือ (Stock)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={selectedPart.stock ?? 0}
                  onChange={e => setSelectedPart({ ...selectedPart, stock: Number(e.target.value) || 0 })}
                  className="border-gray-200"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-[#475569]">สถานะการใช้งาน</label>
                <select
                  className="w-full p-2 border rounded-md text-sm bg-white border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
                  value={String(selectedPart.isActive)}
                  onChange={e => setSelectedPart({ ...selectedPart, isActive: e.target.value === 'true' })}
                >
                  <option value="true">Active (ใช้งานปกติ)</option>
                  <option value="false">Inactive (ปิดใช้งาน)</option>
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-[#475569]">คำอธิบาย / รายละเอียดเพิ่มเติม</label>
                <textarea
                  className="w-full p-2 border rounded-md text-sm min-h-[85px] border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
                  placeholder="ข้อมูลเพิ่มเติม..."
                  value={selectedPart.description || ''}
                  onChange={e => setSelectedPart({ ...selectedPart, description: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="border-gray-200">ยกเลิก</Button>
            <Button className="bg-[#0d9488] hover:bg-[#0f766e] text-white" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

