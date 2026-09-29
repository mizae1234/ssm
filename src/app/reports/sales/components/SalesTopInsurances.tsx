"use client"

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { TOP_INSURANCE_COLORS } from '../constants'
import { InsuranceSalesSummary } from '../types'

interface SalesTopInsurancesProps {
  insurances: InsuranceSalesSummary[]
  onSelectInsurance: (insuranceId: string) => void
}

export function SalesTopInsurances({
  insurances,
  onSelectInsurance,
}: SalesTopInsurancesProps) {
  const topInsurances = insurances.slice(0, 5)
  if (topInsurances.length === 0) return null

  const top5TotalPct = topInsurances
    .reduce((sum, ins) => sum + ins.percentage, 0)
    .toFixed(1)

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#0f172a]">
            สัดส่วนยอดขาย 5 อันดับแรก (Top 5 Insurance Companies Share)
          </span>
          <span className="text-xs text-[#64748b]">
            รวมยอด Top 5:{' '}
            <span className="font-semibold text-[#0d9488]">{top5TotalPct}%</span>
          </span>
        </div>

        {/* Stacked Progress Bar */}
        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden flex">
          {topInsurances.map((ins, i) => {
            const colorClass = TOP_INSURANCE_COLORS[i % TOP_INSURANCE_COLORS.length]
            return (
              <div
                key={ins.insuranceId}
                style={{ width: `${Math.max(ins.percentage, 1)}%` }}
                className={`${colorClass} transition-all`}
                title={`${ins.insuranceName}: ${ins.percentage}% (฿${formatCurrency(ins.grandTotal)})`}
              />
            )
          })}
        </div>

        {/* Clickable Legend */}
        <div className="flex flex-wrap gap-4 mt-3 pt-2 text-xs text-[#64748b]">
          {topInsurances.map((ins, i) => {
            const colorClass = TOP_INSURANCE_COLORS[i % TOP_INSURANCE_COLORS.length]
            return (
              <button
                key={ins.insuranceId}
                type="button"
                onClick={() => onSelectInsurance(ins.insuranceId)}
                className="flex items-center gap-1.5 hover:text-[#0d9488] transition-colors cursor-pointer group text-left"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${colorClass} group-hover:scale-110 transition-transform`}
                />
                <span className="font-medium text-[#0f172a] group-hover:text-[#0d9488] truncate max-w-[180px]">
                  {ins.insuranceName}
                </span>
                <span className="text-[11px] text-[#94a3b8] font-mono">
                  ({ins.percentage}%)
                </span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
