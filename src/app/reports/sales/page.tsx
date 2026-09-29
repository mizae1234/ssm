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
  ShoppingCart,
  Receipt,
} from 'lucide-react'

import { SalesFilters } from './components/SalesFilters'
import { SalesKpiCards } from './components/SalesKpiCards'
import { SalesTopInsurances } from './components/SalesTopInsurances'
import { InsuranceSummaryTable } from './components/InsuranceSummaryTable'
import { SalesDetailTable } from './components/SalesDetailTable'
import { exportSalesReportExcel } from './utils/exportExcel'
import { DEFAULT_PAGE_SIZE } from './constants'
import {
  SalesFilterValues,
  SalesReportResponse,
  SalesInvoiceDetail,
} from './types'

// Local date helper without UTC shift issues
function formatLocalInputDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function SalesReportPage() {
  const [data, setData] = useState<SalesReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [insurancesList, setInsurancesList] = useState<any[]>([])

  // Filter state
  const [filters, setFilters] = useState<SalesFilterValues>(() => {
    const now = new Date()
    return {
      dateFrom: formatLocalInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      dateTo: formatLocalInputDate(now),
      insuranceId: '',
      insuranceSearch: '',
      status: 'ACTIVE',
      search: '',
    }
  })

  // Table tabs & detail-specific state
  const [activeTab, setActiveTab] = useState('summary')
  const [detailSearch, setDetailSearch] = useState('')
  const [detailPage, setDetailPage] = useState(1)

  // Fetch insurances list for filter
  useEffect(() => {
    fetch('/api/insurances')
      .then(res => res.json())
      .then(resData => {
        if (Array.isArray(resData)) {
          setInsurancesList(resData)
        }
      })
      .catch(console.error)
  }, [])

  // Fetch sales report data
  const fetchReport = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
    if (filters.insuranceId) params.set('insuranceId', filters.insuranceId)
    if (filters.insuranceSearch) params.set('insuranceSearch', filters.insuranceSearch)
    if (filters.status) params.set('status', filters.status)
    if (filters.search) params.set('search', filters.search)

    fetch(`/api/reports/sales?${params}`)
      .then(res => res.json())
      .then((resData: SalesReportResponse) => {
        setData(resData)
        setLoading(false)
        setDetailPage(1)
      })
      .catch(err => {
        console.error('Failed to fetch sales report:', err)
        setLoading(false)
      })
  }, [filters])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const handleFilterChange = (key: keyof SalesFilterValues, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleResetFilters = () => {
    const now = new Date()
    setFilters({
      dateFrom: formatLocalInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      dateTo: formatLocalInputDate(now),
      insuranceId: '',
      insuranceSearch: '',
      status: 'ACTIVE',
      search: '',
    })
    setDetailSearch('')
  }

  // Filtered details
  const filteredDetails = useMemo(() => {
    if (!data?.details) return []
    let list = data.details

    if (detailSearch.trim()) {
      const q = detailSearch.toLowerCase().trim()
      list = list.filter(inv => {
        const invMatch = inv.invoiceNo?.toLowerCase().includes(q)
        const insMatch = inv.insurance?.name?.toLowerCase().includes(q)
        const claimMatch = inv.claims?.some(c =>
          c.claimNo?.toLowerCase().includes(q) ||
          c.carPlate?.toLowerCase().includes(q) ||
          c.insuredName?.toLowerCase().includes(q)
        )
        return invMatch || insMatch || claimMatch
      })
    }
    return list
  }, [data?.details, detailSearch])

  // Drilldown from insurance summary to detail tab
  const handleInsuranceDrilldown = (insId: string) => {
    const ins = data?.byInsurance?.find(item => item.insuranceId === insId)
    handleFilterChange('insuranceId', insId)
    if (ins) {
      handleFilterChange('insuranceSearch', ins.insuranceName)
    }
    setActiveTab('details')
  }

  // Handle multi-sheet Excel export
  const handleExportExcel = async () => {
    if (!data) return
    try {
      setExporting(true)
      await exportSalesReportExcel({
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
            <h1 className="text-2xl font-bold text-[#0f172a]">รายงานขาย</h1>
            <Badge className="bg-teal-50 text-[#0d9488] border-teal-200 text-xs">
              Sales Invoices
            </Badge>
          </div>
          <p className="text-sm text-[#64748b] mt-1">
            รายงานสรุปยอดขายแยกตามบริษัทประกันภัย และรายละเอียดการวางบิล
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Navigation Switcher */}
          <Link
            href="/reports"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-[#475569] hover:bg-gray-50 hover:text-[#0d9488] transition-colors shadow-sm"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>ภาพรวมการเงิน</span>
          </Link>
          <Link
            href="/reports/purchases"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-[#475569] hover:bg-gray-50 hover:text-[#0d9488] transition-colors shadow-sm"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>รายงานซื้อ</span>
          </Link>

          {/* Export Excel (2 Sheets) Button */}
          <Button
            onClick={handleExportExcel}
            disabled={loading || !data || data.byInsurance.length === 0 || exporting}
            className="gap-2 bg-gradient-to-r from-[#0d9488] to-[#0f766e] text-white hover:from-[#0f766e] hover:to-[#115e59] shadow-sm font-semibold text-xs px-4 h-9"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'กำลังสร้างไฟล์ Excel...' : 'Export Excel (2 Sheets)'}
          </Button>
        </div>
      </div>

      {/* ─── Filter Bar Component ─── */}
      <SalesFilters
        filters={filters}
        insurances={insurancesList}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* ─── KPI Cards Component ─── */}
      <SalesKpiCards summary={data?.summary} loading={loading} />

      {/* ─── Top Insurances Volume Share Component ─── */}
      {!loading && data && data.byInsurance.length > 0 && (
        <SalesTopInsurances
          insurances={data.byInsurance}
          onSelectInsurance={handleInsuranceDrilldown}
        />
      )}

      {/* ─── Main Tabs: Summary vs Details ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="summary" className="gap-2 text-xs">
              <Layers className="w-3.5 h-3.5" />
              1. สรุปยอดตาม บ.ประกัน ({data?.byInsurance?.length || 0} บริษัท)
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-2 text-xs">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              2. รายละเอียดการวางบิล ({filteredDetails.length.toLocaleString()} ใบ)
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

        {/* Tab 1: Insurance Summary */}
        <TabsContent value="summary" className="mt-0 space-y-4">
          <InsuranceSummaryTable
            insurances={data?.byInsurance || []}
            summary={data?.summary}
            loading={loading}
            selectedInsuranceId={filters.insuranceId || filters.insuranceSearch}
            onSelectInsurance={handleInsuranceDrilldown}
            onClearFilter={() => {
              handleFilterChange('insuranceId', '')
              handleFilterChange('insuranceSearch', '')
            }}
          />
        </TabsContent>

        {/* Tab 2: Invoice & Claims Detail */}
        <TabsContent value="details" className="mt-0 space-y-4">
          <SalesDetailTable
            invoices={filteredDetails}
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
