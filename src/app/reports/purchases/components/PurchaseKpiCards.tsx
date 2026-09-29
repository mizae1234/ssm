"use client"

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Receipt, TrendingUp, ShoppingCart, Building2, Package } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { PurchaseReportSummary } from '../types'

interface PurchaseKpiCardsProps {
  summary: PurchaseReportSummary | null | undefined
  loading: boolean
}

export function PurchaseKpiCards({ summary, loading }: PurchaseKpiCardsProps) {
  const grandTotal = summary?.grandTotalAmount || 0
  const subtotal = summary?.grandSubtotal || 0
  const computedVat = Math.max(0, grandTotal - subtotal)
  const totalPOs = summary?.totalPOs || 0
  const totalVendors = summary?.totalVendors || 0
  const totalItems = summary?.totalItems || 0

  const avgPerPO = totalPOs > 0 ? grandTotal / totalPOs : 0
  const avgItemsPerPO = totalPOs > 0 ? (totalItems / totalPOs).toFixed(1) : '0'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Grand Total Amount */}
      <Card className="border border-gray-200 shadow-sm bg-gradient-to-br from-white to-teal-50/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748b]">ยอดสั่งซื้อรวม (สุทธิ)</span>
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
                ภาษี (VAT): ฿{formatCurrency(computedVat)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Total POs */}
      <Card className="border border-gray-200 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748b]">จำนวนใบสั่งซื้อ (PO)</span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-7 w-20 mt-2" />
          ) : (
            <div className="mt-2">
              <div className="text-xl font-bold text-[#0f172a]">
                {totalPOs}{' '}
                <span className="text-xs font-normal text-[#64748b]">ใบ</span>
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">
                เฉลี่ย ฿{formatCurrency(avgPerPO)}/PO
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Total Vendors */}
      <Card className="border border-gray-200 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748b]">จำนวนผู้ขาย (Vendors)</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-7 w-20 mt-2" />
          ) : (
            <div className="mt-2">
              <div className="text-xl font-bold text-[#0f172a]">
                {totalVendors}{' '}
                <span className="text-xs font-normal text-[#64748b]">เจ้า</span>
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">ที่มีรายการซื้อในช่วงนี้</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Total Items */}
      <Card className="border border-gray-200 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#64748b]">จำนวนชิ้น / รายการ</span>
            <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
              <Package className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-7 w-20 mt-2" />
          ) : (
            <div className="mt-2">
              <div className="text-xl font-bold text-[#0f172a]">
                {totalItems.toLocaleString()}{' '}
                <span className="text-xs font-normal text-[#64748b]">ชิ้น</span>
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">
                เฉลี่ย {avgItemsPerPO} ชิ้น/PO
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
