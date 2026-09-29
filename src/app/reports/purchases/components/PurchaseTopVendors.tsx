"use client"

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { TOP_VENDOR_COLORS } from '../constants'
import { VendorPurchaseSummary } from '../types'

interface PurchaseTopVendorsProps {
  vendors: VendorPurchaseSummary[]
  onSelectVendor: (vendorId: string) => void
}

export function PurchaseTopVendors({
  vendors,
  onSelectVendor,
}: PurchaseTopVendorsProps) {
  const topVendors = vendors.slice(0, 5)
  if (topVendors.length === 0) return null

  const top5TotalPct = topVendors
    .reduce((sum, v) => sum + v.percentage, 0)
    .toFixed(1)

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#0f172a]">
            สัดส่วนยอดสั่งซื้อ 5 อันดับแรก (Top 5 Vendors Share)
          </span>
          <span className="text-xs text-[#64748b]">
            รวมยอด Top 5:{' '}
            <span className="font-semibold text-[#0d9488]">{top5TotalPct}%</span>
          </span>
        </div>

        {/* Stacked Progress Bar */}
        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden flex">
          {topVendors.map((v, i) => {
            const colorClass = TOP_VENDOR_COLORS[i % TOP_VENDOR_COLORS.length]
            return (
              <div
                key={v.vendorId}
                style={{ width: `${Math.max(v.percentage, 1)}%` }}
                className={`${colorClass} transition-all`}
                title={`${v.vendorName}: ${v.percentage}% (฿${formatCurrency(v.totalAmount)})`}
              />
            )
          })}
        </div>

        {/* Clickable Legend */}
        <div className="flex flex-wrap gap-4 mt-3 pt-2 text-xs text-[#64748b]">
          {topVendors.map((v, i) => {
            const colorClass = TOP_VENDOR_COLORS[i % TOP_VENDOR_COLORS.length]
            return (
              <button
                key={v.vendorId}
                type="button"
                onClick={() => onSelectVendor(v.vendorId)}
                className="flex items-center gap-1.5 hover:text-[#0d9488] transition-colors cursor-pointer group text-left"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${colorClass} group-hover:scale-110 transition-transform`}
                />
                <span className="font-medium text-[#0f172a] group-hover:text-[#0d9488] truncate max-w-[160px]">
                  {v.vendorName}
                </span>
                <span className="text-[11px] text-[#94a3b8] font-mono">
                  ({v.percentage}%)
                </span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
