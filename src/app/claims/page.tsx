"use client"

import { useState, useMemo, useEffect } from 'react'
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
          <div className="bg-white rounded-xl max-w-xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-white p-5 shrink-0">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0d9488]" />
                ยืนยันการออกใบวางบิล/ใบแจ้งหนี้รวม
              </h3>
              <p className="text-xs text-slate-400 mt-1">ออกใบกำกับภาษีเพียง 1 ใบ ควบรวมหลายเคสเคลม</p>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">บริษัทประกันภัย</span>
                <p className="font-semibold text-slate-800 text-sm">{selectedClaimsList[0]?.insurance?.name || '-'}</p>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">รายการเคสเคลมที่เลือก ({selectedCount} เคส)</span>
                <div className="max-h-36 overflow-y-auto border rounded-lg p-2.5 bg-slate-50 space-y-1">
                  {selectedClaimsList.map(c => (
                    <div key={c.id} className="flex justify-between items-center text-xs py-1 border-b border-gray-100 last:border-0">
                      <span className="font-semibold text-[#0d9488]">{c.claimNo}</span>
                      <span className="text-gray-500">{c.carPlate} ({c.carBrand} {c.carModel})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial preview */}
              {loadingPreview ? (
                <div className="text-center py-6 text-slate-550 text-xs font-medium animate-pulse bg-slate-50 border border-dashed rounded-xl">
                  ⌛ กำลังคำนวณและประมวลผลยอดเงินรวมตัวอย่าง...
                </div>
              ) : previewData ? (
                <div className="space-y-4">
                  {/* Financial breakdown */}
                  <div className="bg-slate-50 border rounded-xl p-4 space-y-2 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>ค่าอะไหล่รวม:</span>
                      <span className="font-semibold text-slate-800">฿{formatCurrency(previewData.partsTotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>ค่าแรงรวม:</span>
                      <span className="font-semibold text-slate-800">฿{formatCurrency(previewData.laborTotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-650 border-t pt-1.5 mt-1 border-dashed">
                      <span>ยอดก่อนภาษี (Subtotal):</span>
                      <span className="font-semibold text-slate-800">฿{formatCurrency(previewData.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
                      <span className="font-semibold text-slate-800">฿{formatCurrency(previewData.vatAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-teal-700 border-t pt-2 mt-1 border-slate-200">
                      <span>ยอดรวมทั้งสิ้น (Grand Total):</span>
                      <span>฿{formatCurrency(previewData.grandTotal)}</span>
                    </div>
                  </div>

                  {/* Expandable Preview Line Items */}
                  <div className="border rounded-xl overflow-hidden">
                    <details className="group">
                      <summary className="bg-slate-100 hover:bg-slate-200/80 p-3 px-4 text-xs font-semibold text-slate-700 flex justify-between items-center cursor-pointer select-none">
                        <span>ดูรายการย่อยที่ระบุในใบกำกับภาษี (Preview Line Items)</span>
                        <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full group-open:hidden">คลิกเพื่อดู</span>
                        <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full hidden group-open:inline">คลิกเพื่อซ่อน</span>
                      </summary>
                      <div className="p-3 border-t bg-white max-h-48 overflow-y-auto space-y-3">
                        {previewData.claims.map((c: any) => (
                          <div key={c.id} className="space-y-1.5">
                            <div className="bg-[#eff6ff] p-1.5 px-2.5 rounded text-xs font-bold text-slate-800">
                              🔎 เคส {c.claimNo} (ทะเบียน {c.carPlate})
                            </div>
                            <div className="space-y-1 pl-2 text-xs">
                              {c.parts.length === 0 && c.labors.length === 0 && (
                                <p className="text-gray-400 italic">ไม่มีรายการอะไหล่และค่าแรงที่อนุมัติ</p>
                              )}
                              {c.parts.map((p: any) => (
                                <div key={p.id} className="flex justify-between text-gray-600 py-0.5 border-b border-dashed border-gray-50 last:border-0">
                                  <span className="text-[#475569]">{p.partName} {p.partNo && p.partNo !== '-' && `(${p.partNo})`} x {p.quantity}</span>
                                  <span className="font-mono text-slate-700">฿{formatCurrency(p.total)}</span>
                                </div>
                              ))}
                              {c.labors.map((l: any) => (
                                <div key={l.id} className="flex justify-between text-gray-600 py-0.5 border-b border-dashed border-gray-50 last:border-0">
                                  <span className="text-[#475569]">{l.description} (ค่าแรง)</span>
                                  <span className="font-mono text-slate-700">฿{formatCurrency(l.priceApprove)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">วันที่เอกสาร</label>
                  <input
                    type="date"
                    className="w-full mt-1 p-2 text-sm border rounded-lg font-medium text-slate-800 bg-white"
                    value={batchInvoiceDate}
                    onChange={e => setBatchInvoiceDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">เงื่อนไขการชำระเงิน</label>
                  <p className="mt-2.5 text-sm font-semibold text-slate-800">
                    ตามเครดิตเทอมประกัน ({selectedClaimsList[0]?.insurance?.creditTermArDays ?? 30} วัน)
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-xs flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">ข้อควรทราบก่อนกดยืนยัน:</p>
                  <p className="mt-0.5 text-amber-700 leading-relaxed">
                    เมื่อกดยืนยัน ระบบจะทำใบวางบิลรวมเป็นเลขที่บิลเดียว และเปลี่ยนสถานะของเคสย่อยทั้งหมดเป็น **"ส่งวางบิลแล้ว (INVOICE_SENT)"** พร้อมกัน
                  </p>
                </div>
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

