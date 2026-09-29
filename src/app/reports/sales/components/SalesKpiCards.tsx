"use client"

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Receipt, TrendingUp, Shield, FileText, Wrench, Layers } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { SalesReportSummary } from '../types'

interface SalesKpiCardsProps {
  summary: SalesReportSummary | null | undefined
  loading: boolean
}

export function SalesKpiCards({ summary, loading }: SalesKpiCardsProps) {
  const grandTotal = summary?.grandTotalAmount || 0
  const subtotal = summary?.grandSubtotal || 0
  const vatAmount = summary?.grandVatAmount || 0
  const partsTotal = summary?.grandPartsTotal || 0
  const laborTotal = summary?.grandLaborTotal || 0
  const totalInvoices = summary?.totalInvoices || 0
  const totalClaims = summary?.totalClaims || 0
  const totalInsurances = summary?.totalInsurances || 0

  const avgPerInvoice = totalInvoices > 0 ? grandTotal / totalInvoices : 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
      {/* 1. Grand Total Sales */}
      <Card className="border border-gray-200 shadow-sm bg-gradient-to-br from-white to-teal-50/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748b]">ยอดขายรวมสุทธิ</span>
            <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-[#0d9488]" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-7 w-28 mt-2" />
          ) : (
            <div className="mt-2">
              <div className="text-xl font-bold text-[#0d9488]">
                ฿{formatCurrency(grandTotal)}
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">รวมภาษีมูลค่าเพิ่ม</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Subtotal & VAT */}
      <Card className="border border-gray-200 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748b]">ยอดก่อน VAT</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-7 w-28 mt-2" />
          ) : (
            <div className="mt-2">
              <div className="text-xl font-bold text-[#0f172a]">
                ฿{formatCurrency(subtotal)}
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">
                VAT: ฿{formatCurrency(vatAmount)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Parts Total */}
      <Card className="border border-gray-200 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748b]">ค่าอะไหล่</span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-7 w-20 mt-2" />
          ) : (
            <div className="mt-2">
              <div className="text-xl font-bold text-[#0f172a]">
                ฿{formatCurrency(partsTotal)}
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">
                {subtotal > 0 ? ((partsTotal / subtotal) * 100).toFixed(1) : 0}% ของยอดก่อน VAT
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Total Invoices */}
      <Card className="border border-gray-200 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748b]">จำนวนวางบิล</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-7 w-20 mt-2" />
          ) : (
            <div className="mt-2">
              <div className="text-xl font-bold text-[#0f172a]">
                {totalInvoices}{' '}
                <span className="text-xs font-normal text-[#64748b]">ใบ</span>
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">
                เฉลี่ย ฿{formatCurrency(avgPerInvoice)}/ใบ
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Total Claims */}
      <Card className="border border-gray-200 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748b]">จำนวนเคลม</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
              <Layers className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-7 w-20 mt-2" />
          ) : (
            <div className="mt-2">
              <div className="text-xl font-bold text-[#0f172a]">
                {totalClaims}{' '}
                <span className="text-xs font-normal text-[#64748b]">เคส</span>
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">ในรายการวางบิล</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. Total Insurances */}
      <Card className="border border-gray-200 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748b]">บ.ประกัน (ลูกค้า)</span>
            <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
              <Shield className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-7 w-20 mt-2" />
          ) : (
            <div className="mt-2">
              <div className="text-xl font-bold text-[#0f172a]">
                {totalInsurances}{' '}
                <span className="text-xs font-normal text-[#64748b]">บริษัท</span>
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">ที่วางบิลในช่วงนี้</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
