"use client"

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  Download,
  Search,
  Layers,
  FileSpreadsheet,
} from 'lucide-react'

import { PurchaseFilters } from './components/PurchaseFilters'
import { PurchaseKpiCards } from './components/PurchaseKpiCards'
import { PurchaseTopVendors } from './components/PurchaseTopVendors'
import { VendorSummaryTable } from './components/VendorSummaryTable'
import { PurchaseDetailTable } from './components/PurchaseDetailTable'
import { exportPurchaseReportExcel } from './utils/exportExcel'
import { DEFAULT_PAGE_SIZE } from './constants'
import {
  PurchaseFilterValues,
  PurchaseReportResponse,
  FlattenedItemRow,
} from './types'

// Local date string helper without UTC offset issues
function formatLocalInputDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function PurchaseReportPage() {
  const [data, setData] = useState<PurchaseReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [vendorsList, setVendorsList] = useState<any[]>([])

  // Filter state
  const [filters, setFilters] = useState<PurchaseFilterValues>(() => {
    const now = new Date()
    return {
      dateFrom: formatLocalInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      dateTo: formatLocalInputDate(now),
      vendorId: '',
      vendorSearch: '',
      status: 'ACTIVE',
      poType: 'ALL',
      search: '',
    }
  })

  // Table tabs & detail-specific state
  const [activeTab, setActiveTab] = useState('summary')
  const [detailSearch, setDetailSearch] = useState('')
  const [detailPage, setDetailPage] = useState(1)

  // Fetch vendors list for filter dropdown
  useEffect(() => {
    fetch('/api/vendors')
      .then(res => res.json())
      .then(resData => {
        if (Array.isArray(resData)) {
          setVendorsList(resData)
        }
      })
      .catch(console.error)
  }, [])

  // Fetch report data
  const fetchReport = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
    if (filters.vendorId) params.set('vendorId', filters.vendorId)
    if (filters.vendorSearch) params.set('vendorSearch', filters.vendorSearch)
    if (filters.status) params.set('status', filters.status)
    if (filters.poType && filters.poType !== 'ALL') params.set('poType', filters.poType)
    if (filters.search) params.set('search', filters.search)

    fetch(`/api/reports/purchases?${params}`)
      .then(res => res.json())
      .then((resData: PurchaseReportResponse) => {
        setData(resData)
        setLoading(false)
        setDetailPage(1)
      })
      .catch(err => {
        console.error('Failed to fetch purchase report:', err)
        setLoading(false)
      })
  }, [filters])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const handleFilterChange = (key: keyof PurchaseFilterValues, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleResetFilters = () => {
    const now = new Date()
    setFilters({
      dateFrom: formatLocalInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      dateTo: formatLocalInputDate(now),
      vendorId: '',
      vendorSearch: '',
      status: 'ACTIVE',
      poType: 'ALL',
      search: '',
    })
    setDetailSearch('')
  }

  // Flatten detail rows for table and filtering
  const flattenedItems = useMemo(() => {
    if (!data?.details) return []
    const rows: FlattenedItemRow[] = []
    let seq = 1

    const q = detailSearch.toLowerCase().trim()

    for (const po of data.details) {
      const poMatchesQuery = !q || (
        po.poNo?.toLowerCase().includes(q) ||
        po.vendor?.name?.toLowerCase().includes(q) ||
        po.claim?.claimNo?.toLowerCase().includes(q) ||
        po.claim?.carPlate?.toLowerCase().includes(q)
      )

      if (po.items && po.items.length > 0) {
        for (const it of po.items) {
          const itemMatchesQuery = !q || (
            poMatchesQuery ||
            it.partNo?.toLowerCase().includes(q) ||
            it.description?.toLowerCase().includes(q)
          )

          if (itemMatchesQuery) {
            rows.push({
              seq: seq++,
              poId: po.id,
              poNo: po.poNo,
              poDate: po.createdAt,
              status: po.status,
              poType: po.poType,
              vendorName: po.vendor?.name || '-',
              vendorCode: po.vendor?.peakVendorCode || po.vendor?.id,
              vendorType: po.vendor?.vendorType,
              taxId: po.vendor?.taxId || '-',
              claimNo: po.claim?.claimNo || '-',
              carPlate: po.claim?.carPlate || '-',
              carBrandModel: [po.claim?.carBrand, po.claim?.carModel].filter(Boolean).join(' ') || '-',
              insuranceName: po.claim?.insuranceName || '-',
              partNo: it.partNo || '-',
              description: it.description || '-',
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discountPct: it.discountPct,
              totalPrice: it.totalPrice,
              poTotalAmount: po.totalAmount,
            })
          }
        }
      } else if (poMatchesQuery) {
        rows.push({
          seq: seq++,
          poId: po.id,
          poNo: po.poNo,
          poDate: po.createdAt,
          status: po.status,
          poType: po.poType,
          vendorName: po.vendor?.name || '-',
          vendorCode: po.vendor?.peakVendorCode || po.vendor?.id,
          vendorType: po.vendor?.vendorType,
          taxId: po.vendor?.taxId || '-',
          claimNo: po.claim?.claimNo || '-',
          carPlate: po.claim?.carPlate || '-',
          carBrandModel: [po.claim?.carBrand, po.claim?.carModel].filter(Boolean).join(' ') || '-',
          insuranceName: po.claim?.insuranceName || '-',
          partNo: '-',
          description: 'ไม่มีรายการย่อย',
          quantity: 1,
          unitPrice: po.totalAmount,
          discountPct: 0,
          totalPrice: po.totalAmount,
          poTotalAmount: po.totalAmount,
        })
      }
    }
    return rows
  }, [data?.details, detailSearch])

  // Drilldown from vendor summary row to detail tab
  const handleVendorDrilldown = (vId: string) => {
    const v = data?.byVendor?.find(item => item.vendorId === vId)
    handleFilterChange('vendorId', vId)
    if (v) {
      handleFilterChange('vendorSearch', v.vendorName)
    }
    setActiveTab('details')
  }

  // Handle multi-sheet Excel export
  const handleExportExcel = async () => {
    if (!data) return
    try {
      setExporting(true)
      await exportPurchaseReportExcel({
        data,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      })
    } catch (err) {
      console.error('Export Excel failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Top Header & Navigation ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#0f172a]">รายงานซื้อ</h1>
            <Badge className="bg-teal-50 text-[#0d9488] border-teal-200 text-xs">
              Purchase Orders
            </Badge>
          </div>
          <p className="text-sm text-[#64748b] mt-1">
            รายงานยอดสั่งซื้อแยกตามผู้ขาย (Vendor) และรายละเอียดรายการสั่งซื้อ (PO)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Links to Reports */}
          <Link
            href="/reports"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-[#475569] hover:bg-gray-50 hover:text-[#0d9488] transition-colors shadow-sm"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>ภาพรวมการเงิน</span>
          </Link>
          <Link
            href="/reports/sales"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-[#475569] hover:bg-gray-50 hover:text-[#0d9488] transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>รายงานขาย</span>
          </Link>

          {/* Export Excel (2 Sheets) Button */}
          <Button
            onClick={handleExportExcel}
            disabled={loading || !data || data.byVendor.length === 0 || exporting}
            className="gap-2 bg-gradient-to-r from-[#0d9488] to-[#0f766e] text-white hover:from-[#0f766e] hover:to-[#115e59] shadow-sm font-semibold text-xs px-4 h-9"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'กำลังสร้างไฟล์ Excel...' : 'Export Excel (2 Sheets)'}
          </Button>
        </div>
      </div>

      {/* ─── Filter Bar Component ─── */}
      <PurchaseFilters
        filters={filters}
        vendors={vendorsList}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* ─── KPI Cards Component ─── */}
      <PurchaseKpiCards summary={data?.summary} loading={loading} />

      {/* ─── Top Vendors Volume Share Component ─── */}
      {!loading && data && data.byVendor.length > 0 && (
        <PurchaseTopVendors
          vendors={data.byVendor}
          onSelectVendor={handleVendorDrilldown}
        />
      )}

      {/* ─── Main Tabs: Summary vs Details ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="summary" className="gap-2 text-xs">
              <Layers className="w-3.5 h-3.5" />
              1. สรุปยอดตามผู้ขาย ({data?.byVendor?.length || 0} เจ้า)
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-2 text-xs">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              2. รายละเอียดใบสั่งซื้อ ({flattenedItems.length.toLocaleString()} รายการ)
            </TabsTrigger>
          </TabsList>

          {activeTab === 'details' && (
            <div className="relative w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="กรองในตารางรายละเอียด..."
                value={detailSearch}
                onChange={e => {
                  setDetailSearch(e.target.value)
                  setDetailPage(1)
                }}
                className="pl-8 h-8 text-xs bg-white"
              />
            </div>
          )}
        </div>

        {/* Tab 1: Vendor Summary */}
        <TabsContent value="summary" className="mt-0 space-y-4">
          <VendorSummaryTable
            vendors={data?.byVendor || []}
            summary={data?.summary}
            loading={loading}
            selectedVendorId={filters.vendorId || filters.vendorSearch}
            onSelectVendor={handleVendorDrilldown}
            onClearVendorFilter={() => {
              handleFilterChange('vendorId', '')
              handleFilterChange('vendorSearch', '')
            }}
          />
        </TabsContent>

        {/* Tab 2: PO & Items Detail */}
        <TabsContent value="details" className="mt-0 space-y-4">
          <PurchaseDetailTable
            items={flattenedItems}
            loading={loading}
            page={detailPage}
            pageSize={DEFAULT_PAGE_SIZE}
            onPageChange={setDetailPage}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
