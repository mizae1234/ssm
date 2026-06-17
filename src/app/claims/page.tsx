"use client"

import { useState, useMemo, useEffect, Fragment } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Filter, Eye, MoreHorizontal, AlertTriangle, FileText } from 'lucide-react'
import { getStatusColor, getStatusLabel, formatCurrency } from '@/lib/utils'
import { formatDate } from '@/lib/date'
import { ClaimStatus } from '@/lib/types'
import { Skeleton, SkeletonStatusPill, SkeletonTableRows } from '@/components/ui/skeleton'

const statuses: ClaimStatus[] = ['RECEIVED', 'PARTS_CHECK', 'PO_ISSUED', 'GOODS_RECEIVED', 'INVOICE_SENT', 'AP_PAID', 'AR_RECEIVED', 'CLOSED', 'CANCELLED']

export default function ClaimsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [insuranceFilter, setInsuranceFilter] = useState<string>('')
  const [claims, setClaims] = useState<any[]>([])
  const [insurances, setInsurances] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const [debouncedSearch, setDebouncedSearch] = useState(search)

  // Consolidated Invoicing states
  const [selectedClaimIds, setSelectedClaimIds] = useState<Record<string, boolean>>({})
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [batchInvoiceDate, setBatchInvoiceDate] = useState(new Date().toISOString().substring(0, 10))
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const [previewData, setPreviewData] = useState<any>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, statusFilter, insuranceFilter])

  useEffect(() => {
    // Reset selection when parameters change
    setSelectedClaimIds({})
  }, [currentPage, debouncedSearch, statusFilter, insuranceFilter])

  useEffect(() => {
    fetch('/api/insurances')
      .then(res => res.json())
      .then(data => {
        setInsurances(data)
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(currentPage))
    params.set('limit', String(itemsPerPage))
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (statusFilter) params.set('status', statusFilter)
    if (insuranceFilter) params.set('insuranceId', insuranceFilter)

    fetch(`/api/claims?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setClaims(data.claims || [])
        setTotal(data.total || 0)
        setStatusCounts(data.statusCounts || {})
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [currentPage, debouncedSearch, statusFilter, insuranceFilter])

  // Eligibility check for consolidated invoicing
  const isEligible = (c: any) => !c.insuranceInvoiceId && c.status !== 'RECEIVED' && c.status !== 'CANCELLED'

  const handleToggleSelect = (id: string, checked: boolean) => {
    setSelectedClaimIds(prev => {
      const copy = { ...prev }
      if (checked) {
        copy[id] = true
      } else {
        delete copy[id]
      }
      return copy
    })
  }

  const handleToggleAll = (checked: boolean) => {
    setSelectedClaimIds(prev => {
      const copy = { ...prev }
      claims.forEach(c => {
        if (isEligible(c)) {
          if (checked) {
            copy[c.id] = true
          } else {
            delete copy[c.id]
          }
        }
      })
      return copy
    })
  }

  const selectedClaimsList = useMemo(() => {
    return claims.filter(c => selectedClaimIds[c.id])
  }, [claims, selectedClaimIds])

  const selectedCount = selectedClaimsList.length

  const isSameInsurance = useMemo(() => {
    const insuranceIds = new Set(selectedClaimsList.map(c => c.insurance?.id))
    return insuranceIds.size <= 1
  }, [selectedClaimsList])

  useEffect(() => {
    if (showBatchModal && selectedCount > 0) {
      setLoadingPreview(true)
      setPreviewData(null)
      fetch('/api/invoices/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimIds: selectedClaimsList.map(c => c.id) })
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) throw new Error(data.error)
          setPreviewData(data)
        })
        .catch(err => {
          alert(`เกิดข้อผิดพลาดในการโหลดตัวอย่าง: ${err.message}`)
          setShowBatchModal(false)
        })
        .finally(() => {
          setLoadingPreview(false)
        })
    }
  }, [showBatchModal, selectedCount])

  const handleCreateConsolidatedInvoice = async () => {
    try {
      setIsGenerating(true)
      const claimIds = selectedClaimsList.map(c => c.id)
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimIds,
          invoiceDate: batchInvoiceDate
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create invoice')
      }

      const invoice = await res.json()
      setToastMsg(`สร้างใบแจ้งหนี้รวมเลขที่ ${invoice.invoiceNo} สำเร็จ!`)
      setSelectedClaimIds({})
      setShowBatchModal(false)

      // Refresh data
      const params = new URLSearchParams()
      params.set('page', String(currentPage))
      params.set('limit', String(itemsPerPage))
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (statusFilter) params.set('status', statusFilter)
      if (insuranceFilter) params.set('insuranceId', insuranceFilter)

      const refreshRes = await fetch(`/api/claims?${params.toString()}`)
      const refreshData = await refreshRes.json()
      setClaims(refreshData.claims || [])
      setTotal(refreshData.total || 0)
      setStatusCounts(refreshData.statusCounts || {})

      // Clear toast after 3s
      setTimeout(() => {
        setToastMsg(null)
        window.location.href = '/invoices'
      }, 1500)
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาด: ${err.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16 relative">
      {toastMsg && (
        <div className="fixed top-6 right-6 bg-green-600 text-white px-6 py-3 rounded-xl shadow-2xl z-50 animate-in slide-in-from-top-4 font-medium">
          ✅ {toastMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">Claims</h1>
          <p className="text-sm text-[#94a3b8] mt-1">จัดการ Claim ทั้งหมด ({total} รายการ)</p>
        </div>
        <Link href="/claims/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            รับ Claim ใหม่
          </Button>
        </Link>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-9 gap-2">
        {loading && claims.length === 0 ? (
          Array.from({ length: 9 }).map((_, i) => <SkeletonStatusPill key={i} />)
        ) : statuses.map(status => {
          const count = statusCounts[status] || 0
          const { bg, text } = getStatusColor(status)
          const isActive = statusFilter === status
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(isActive ? '' : status)}
              className={`p-2.5 rounded-xl border text-center transition-all duration-200 ${
                isActive
                  ? 'border-[#0d9488] bg-[#eff6ff] shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-lg font-bold text-[#0f172a]">{count}</div>
              <div className="text-[10px] font-medium text-[#475569] mt-0.5 truncate">{getStatusLabel(status)}</div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="ค้นหา Claim No. / ทะเบียน / ชื่อผู้เอาประกัน..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={insuranceFilter} onChange={e => setInsuranceFilter(e.target.value)} className="w-48">
              <option value="">ทุกบ.ประกัน</option>
              {insurances.map(ins => (
                <option key={ins.id} value={ins.id}>{ins.name}</option>
              ))}
            </Select>
            {(search || statusFilter || insuranceFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter(''); setInsuranceFilter('') }}>
                ล้างตัวกรอง
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Claims Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300"
                    onChange={e => handleToggleAll(e.target.checked)}
                    checked={claims.length > 0 && claims.filter(isEligible).every(c => selectedClaimIds[c.id])}
                  />
                </TableHead>
                <TableHead>Claim No.</TableHead>
                <TableHead>ทะเบียน</TableHead>
                <TableHead>บ.ประกัน</TableHead>
                <TableHead>อู่</TableHead>
                <TableHead>วันที่บันทึก</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <SkeletonTableRows rows={8} cols={8} />
              ) : claims.map(claim => {
                const { bg, text } = getStatusColor(claim.status)
                const hasReturnParts = claim.parts?.some((p: any) => p.requireReturn)
                const eligible = isEligible(claim)
                return (
                  <TableRow key={claim.id} className={!eligible ? 'bg-slate-50/40 opacity-75' : ''}>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={!eligible}
                        checked={!!selectedClaimIds[claim.id]}
                        onChange={e => handleToggleSelect(claim.id, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={`/claims/${claim.id}`} className="text-[#0d9488] hover:underline font-semibold block">
                        {claim.claimNo}
                      </Link>
                      {claim.ePartNo && (
                        <div className="text-xs text-gray-400 font-mono mt-0.5" title="หมายเลข E-Part">
                          EP: {claim.ePartNo}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{claim.carPlate}</div>
                      <div className="text-xs text-[#94a3b8]">{claim.carBrand} {claim.carModel}</div>
                    </TableCell>
                    <TableCell className="text-[#475569] text-sm">{claim.insurance?.name}</TableCell>
                    <TableCell className="text-[#475569] text-sm">{claim.garage?.name}</TableCell>
                    <TableCell className="text-[#475569] text-sm">
                      <div>{formatDate(claim.createdAt)}</div>
                      <div className="text-xs text-gray-400">{new Date(claim.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`status-badge ${bg} ${text}`}>
                        {getStatusLabel(claim.status)}
                      </span>
                      {claim.insuranceInvoice && (
                        <div className="text-[10px] text-gray-500 font-mono mt-1" title="เลขที่ใบวางบิล">
                          IVT: {claim.insuranceInvoice.invoiceNo}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/claims/${claim.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="w-4 h-4 text-[#475569]" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {claims.length === 0 && !loading && (
            <div className="text-center py-12 text-[#94a3b8]">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>ไม่พบ Claim ที่ตรงกับเงื่อนไข</p>
            </div>
          )}

          {total > itemsPerPage && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 p-4">
              <div className="text-sm text-[#94a3b8]">
                แสดง {((currentPage - 1) * itemsPerPage) + 1} ถึง {Math.min(currentPage * itemsPerPage, total)} จากทั้งหมด {total} รายการ
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ก่อนหน้า
                </Button>
                <div className="flex items-center gap-1 text-sm font-medium text-[#475569] px-2">
                  หน้า
                  <select 
                    className="border rounded p-1 mx-1 bg-white outline-none focus:ring-1 focus:ring-blue-500"
                    value={currentPage}
                    onChange={e => setCurrentPage(Number(e.target.value))}
                  >
                    {Array.from({ length: Math.ceil(total / itemsPerPage) }, (_, i) => i + 1).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  จาก {Math.ceil(total / itemsPerPage)}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(total / itemsPerPage), p + 1))}
                  disabled={currentPage >= Math.ceil(total / itemsPerPage)}
                >
                  ถัดไป
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Batch Action Bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white rounded-xl shadow-2xl p-4 px-6 flex items-center gap-6 z-40 border border-slate-800 animate-in slide-in-from-bottom-4 backdrop-blur-sm">
          <span className="text-sm font-medium">เลือกเคลมแล้ว {selectedCount} เคส</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-[#0d9488] hover:bg-[#0f766e] text-xs gap-1.5 font-semibold"
              disabled={!isSameInsurance}
              onClick={() => setShowBatchModal(true)}
            >
              <FileText className="w-3.5 h-3.5" />
              สร้างใบแจ้งหนี้รวม ({selectedClaimsList[0]?.insurance?.name || ''})
            </Button>
            {!isSameInsurance && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                กรุณาเลือกเคลมของบริษัทประกันภัยเดียวกันเท่านั้น
              </span>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in p-4">
          <div className="bg-white rounded-xl max-w-6xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-5 shrink-0 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#0d9488]" />
                  ยืนยันการออกใบวางบิล/ใบแจ้งหนี้รวม (Consolidated Invoice Preview)
                </h3>
                <p className="text-xs text-slate-400 mt-1">ออกใบกำกับภาษีและใบวางบิลเพียง 1 ใบ ควบรวมหลายเคสเคลมตามรายการด้านล่าง</p>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-white transition-colors text-2xl font-semibold leading-none px-2 py-1"
                disabled={isGenerating}
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50/50">
              {/* Left Panel: Information & Totals (1/3 column) */}
              <div className="space-y-4 lg:col-span-1 flex flex-col justify-between h-full bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">บริษัทประกันภัย</span>
                    <p className="font-bold text-slate-800 text-sm bg-slate-105 p-2.5 rounded-lg border border-slate-200">
                      🏢 {selectedClaimsList[0]?.insurance?.name || '-'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">วันที่เอกสาร</label>
                      <input
                        type="date"
                        className="w-full mt-1 p-2 text-sm border rounded-lg font-medium text-slate-800 bg-white focus:ring-2 focus:ring-teal-500 outline-none border-slate-250"
                        value={batchInvoiceDate}
                        onChange={e => setBatchInvoiceDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">เงื่อนไขการชำระเงิน</label>
                      <div className="w-full mt-1 p-2 text-sm border rounded-lg font-semibold text-slate-700 bg-slate-50 border-slate-200">
                        {selectedClaimsList[0]?.insurance?.creditTermArDays ?? 30} วัน (ตามดีล)
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">รายการเคลมที่เลือก ({selectedCount} เคส)</span>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2.5 bg-slate-50 space-y-1.5">
                      {selectedClaimsList.map(c => (
                        <div key={c.id} className="flex justify-between items-center text-xs py-1.5 px-2 bg-white rounded border border-slate-150 shadow-sm">
                          <span className="font-bold text-[#0d9488]">{c.claimNo}</span>
                          <span className="text-slate-600 truncate max-w-[160px]" title={c.carPlate}>
                            🚗 {c.carPlate} ({c.carBrand})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-200">
                  {/* Financial preview summary */}
                  {loadingPreview ? (
                    <div className="text-center py-6 text-slate-500 text-xs font-medium animate-pulse bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                      ⌛ กำลังคำนวณและประมวลผลยอดเงินรวมตัวอย่าง...
                    </div>
                  ) : previewData ? (
                    <div className="bg-slate-900 text-white border border-slate-850 rounded-xl p-4.5 space-y-2.5 shadow-md">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>ค่าอะไหล่รวม (+ค่าส่ง):</span>
                        <span className="font-semibold text-slate-200 font-mono">฿{formatCurrency(previewData.partsTotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>ค่าแรงรวม:</span>
                        <span className="font-semibold text-slate-200 font-mono">฿{formatCurrency(previewData.laborTotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-350 border-t pt-2 border-slate-800">
                        <span>ยอดก่อนภาษี (Subtotal):</span>
                        <span className="font-semibold text-slate-200 font-mono">฿{formatCurrency(previewData.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
                        <span className="font-semibold text-slate-200 font-mono">฿{formatCurrency(previewData.vatAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-teal-400 border-t pt-2.5 border-slate-700">
                        <span>ยอดรวมทั้งสิ้น (Grand Total):</span>
                        <span className="font-mono">฿{formatCurrency(previewData.grandTotal)}</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-xs flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">ข้อควรทราบก่อนกดยืนยัน:</p>
                      <p className="mt-0.5 text-amber-700 leading-relaxed">
                        เมื่อกดยืนยัน ระบบจะผูกเคสย่อยเหล่านี้เข้ากับใบแจ้งหนี้รวมใบเดียว และปรับสถานะเคลมทั้งหมดเป็น **"ส่งวางบิลแล้ว (INVOICE_SENT)"**
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Panel: Invoice Item Table Preview (2/3 columns) */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="bg-slate-100/80 p-4 border-b border-slate-250 flex items-center justify-between shrink-0">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    พรีวิวรายการสินค้า/ค่าบริการตามใบกำกับภาษี (Line Items Preview)
                  </span>
                  <span className="text-[10px] bg-[#eff6ff] text-blue-700 font-bold px-2.5 py-1 rounded-full border border-blue-200">
                    รูปแบบใบวางบิลจริง
                  </span>
                </div>
                
                {loadingPreview ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 space-y-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0d9488]"></div>
                    <span className="text-sm font-medium">กำลังโหลดตารางตัวอย่างสินค้าและค่าบริการ...</span>
                  </div>
                ) : previewData ? (
                  <div className="flex-1 overflow-y-auto p-4 max-h-[60vh]">
                    <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
                      <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                            <th className="py-3 px-3 text-center w-12 border-r border-slate-200">ลำดับ</th>
                            <th className="py-3 px-3 border-r border-slate-200">รายละเอียดสินค้า / รายการอะไหล่ / ค่าบริการ</th>
                            <th className="py-3 px-3 text-right w-16 border-r border-slate-200">จำนวน</th>
                            <th className="py-3 px-3 text-right w-24 border-r border-slate-200">ราคา/หน่วย</th>
                            <th className="py-3 px-3 text-right w-20 border-r border-slate-200">ส่วนลด</th>
                            <th className="py-3 px-3 text-center w-12 border-r border-slate-200">VAT</th>
                            <th className="py-3 px-3 text-right w-28">จำนวนเงิน</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 text-slate-700">
                          {(() => {
                            let itemIndex = 0
                            return previewData.claims.map((c: any) => {
                              const claimItems: any[] = []

                              // Add labors
                              if (c.labors && c.labors.length > 0) {
                                c.labors.forEach((l: any) => {
                                  claimItems.push({
                                    id: l.id,
                                    type: 'labor',
                                    description: l.description + ' (ค่าแรง)',
                                    quantity: 1,
                                    unitPrice: l.priceOffer,
                                    discountPct: l.discountPct,
                                    total: l.priceApprove
                                  })
                                })
                              }

                              // Add parts
                              if (c.parts && c.parts.length > 0) {
                                c.parts.forEach((p: any) => {
                                  claimItems.push({
                                    id: p.id,
                                    type: 'part',
                                    description: p.partName + (p.partNo && p.partNo !== '-' ? ` (${p.partNo})` : ''),
                                    quantity: p.quantity,
                                    unitPrice: p.priceOffer,
                                    discountPct: p.discountPct,
                                    total: p.total
                                  })
                                })
                              }

                              // Add shipping expenses
                              if (c.expenses && c.expenses.length > 0) {
                                c.expenses.forEach((e: any) => {
                                  claimItems.push({
                                    id: e.id,
                                    type: 'expense',
                                    description: e.description,
                                    quantity: 1,
                                    unitPrice: e.amount,
                                    discountPct: 0,
                                    total: e.amount
                                  })
                                })
                              }

                              if (claimItems.length === 0) return null

                              return (
                                <Fragment key={c.id}>
                                  {/* Header row for this Claim */}
                                  <tr className="bg-slate-50 border-t border-b border-slate-200">
                                    <td colSpan={7} className="py-2.5 px-3 text-slate-800 text-xs font-bold text-left bg-teal-50/50 text-teal-850">
                                      📂 เคลมเลขที่ {c.claimNo} (ทะเบียน {c.carPlate || '-'} | {c.carBrand} {c.carModel})
                                    </td>
                                  </tr>
                                  {claimItems.map((item) => {
                                    itemIndex++
                                    return (
                                      <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono border-r border-slate-150">{itemIndex}</td>
                                        <td className="py-2.5 px-3 text-slate-900 font-medium border-r border-slate-150">{item.description}</td>
                                        <td className="py-2.5 px-3 text-right font-mono border-r border-slate-150">{item.quantity}</td>
                                        <td className="py-2.5 px-3 text-right font-mono border-r border-slate-150">฿{formatCurrency(item.unitPrice)}</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-amber-600 border-r border-slate-150">
                                          {item.discountPct > 0 ? `${item.discountPct}%` : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-center text-slate-400 border-r border-slate-150">7%</td>
                                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                                          ฿{formatCurrency(item.total)}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </Fragment>
                              )
                            })
                          })()}
                          {previewData.claims.every((c: any) => (!c.parts || c.parts.length === 0) && (!c.labors || c.labors.length === 0) && (!c.expenses || c.expenses.length === 0)) && (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                                ไม่มีรายการอะไหล่ ค่าแรง หรือค่าจัดส่ง
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-12 text-slate-400 italic">
                    ไม่มีข้อมูลแสดงตัวอย่างรายการ
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-4 px-6 border-t flex justify-end gap-2 shrink-0">
              <Button
                variant="outline"
                disabled={isGenerating || loadingPreview}
                onClick={() => setShowBatchModal(false)}
              >
                ยกเลิก
              </Button>
              <Button
                className="bg-[#0d9488] hover:bg-[#0f766e]"
                disabled={isGenerating || loadingPreview}
                onClick={handleCreateConsolidatedInvoice}
              >
                {isGenerating ? 'กำลังสร้าง...' : 'ยืนยันสร้างใบแจ้งหนี้รวม'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

