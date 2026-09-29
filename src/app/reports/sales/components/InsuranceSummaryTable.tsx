"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonTableRows } from '@/components/ui/skeleton'
import { Shield, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { InsuranceSalesSummary, SalesReportSummary } from '../types'

interface InsuranceSummaryTableProps {
  insurances: InsuranceSalesSummary[]
  summary: SalesReportSummary | null | undefined
  loading: boolean
  selectedInsuranceId?: string
  onSelectInsurance: (insuranceId: string) => void
  onClearFilter: () => void
}

export function InsuranceSummaryTable({
  insurances,
  summary,
  loading,
  selectedInsuranceId,
  onSelectInsurance,
  onClearFilter,
}: InsuranceSummaryTableProps) {
  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="py-4 px-6 flex flex-row items-center justify-between border-b border-gray-100">
        <div>
          <CardTitle className="text-base font-bold text-[#0f172a]">
            สรุปยอดขายแยกตามบริษัทประกัน (Sales Summary by Insurance)
          </CardTitle>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            เรียงตามยอดขายสุทธิสูงสุด (Sheet 1 ในไฟล์ Excel)
          </p>
        </div>

        {selectedInsuranceId && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-xs">
              กำลังแสดงเฉพาะ บ.ประกัน ที่เลือก
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilter}
              className="h-7 text-xs text-[#0d9488]"
            >
              แสดงทุกบริษัท
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="p-6">
            <SkeletonTableRows rows={8} cols={10} />
          </div>
        ) : insurances.length === 0 ? (
          <div className="text-center py-16 text-[#94a3b8]">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#0d9488]" />
            <p className="text-sm font-medium">ไม่พบข้อมูลยอดขายในช่วงเวลาที่เลือก</p>
            <p className="text-xs text-[#cbd5e1] mt-1">ลองเปลี่ยนช่วงเวลาหรือปรับตัวกรอง</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f8faff] hover:bg-[#f8faff]">
                  <TableHead className="w-12 text-center text-xs font-semibold">#</TableHead>
                  <TableHead className="text-xs font-semibold">รหัสลูกค้า</TableHead>
                  <TableHead className="text-xs font-semibold">ชื่อบริษัทประกัน (Customer)</TableHead>
                  <TableHead className="text-center text-xs font-semibold">เครดิต (วัน)</TableHead>
                  <TableHead className="text-center text-xs font-semibold">จำนวนวางบิล</TableHead>
                  <TableHead className="text-center text-xs font-semibold">จำนวนเคลม</TableHead>
                  <TableHead className="text-right text-xs font-semibold">ค่าอะไหล่</TableHead>
                  <TableHead className="text-right text-xs font-semibold">ยอดก่อน VAT</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-[#0d9488]">
                    ยอดขายรวมสุทธิ (฿)
                  </TableHead>
                  <TableHead className="w-36 text-left text-xs font-semibold">สัดส่วน (%)</TableHead>
                  <TableHead className="w-24 text-center text-xs font-semibold">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insurances.map((ins, i) => (
                  <TableRow
                    key={ins.insuranceId}
                    className="hover:bg-teal-50/30 transition-colors"
                  >
                    <TableCell className="text-center text-xs text-[#94a3b8]">{i + 1}</TableCell>
                    <TableCell className="text-xs font-mono text-[#64748b]">
                      {ins.insuranceCode || ins.insuranceId}
                    </TableCell>
                    <TableCell>
                      <div
                        className="font-semibold text-xs text-[#0f172a] hover:text-[#0d9488] cursor-pointer"
                        onClick={() => onSelectInsurance(ins.insuranceId)}
                      >
                        {ins.insuranceName}
                      </div>
                      <div className="text-[11px] text-[#94a3b8] font-mono">
                        Tax ID: {ins.taxId || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs text-[#475569]">
                      {ins.creditTermDays} วัน
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => onSelectInsurance(ins.insuranceId)}
                        className="inline-flex items-center gap-1 font-semibold text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full"
                      >
                        {ins.invoiceCount} ใบ
                      </button>
                    </TableCell>
                    <TableCell className="text-center text-xs text-[#475569]">
                      {ins.claimCount} เคส
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono text-[#475569]">
                      ฿{formatCurrency(ins.partsTotal)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono text-[#475569]">
                      ฿{formatCurrency(ins.subtotal)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold font-mono text-[#0d9488]">
                      ฿{formatCurrency(ins.grandTotal)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold font-mono text-[#0f172a]">
                            {ins.percentage}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#0d9488] to-teal-400 rounded-full"
                            style={{ width: `${Math.min(ins.percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSelectInsurance(ins.insuranceId)}
                        className="h-7 px-2 text-xs text-[#0d9488] hover:text-[#0f766e] hover:bg-teal-50 gap-1"
                      >
                        <span>ดูรายการ</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Summary Row */}
                {summary && (
                  <TableRow className="bg-[#f0fdfa] font-bold border-t-2 border-[#0d9488] text-xs">
                    <TableCell colSpan={2} className="text-center font-bold text-[#0f172a]">
                      รวมทั้งสิ้น
                    </TableCell>
                    <TableCell className="font-bold text-[#0d9488]">
                      {insurances.length} บริษัท
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-center font-bold font-mono text-blue-700">
                      {summary.totalInvoices} ใบ
                    </TableCell>
                    <TableCell className="text-center font-bold font-mono text-[#0f172a]">
                      {summary.totalClaims} เคส
                    </TableCell>
                    <TableCell className="text-right font-bold font-mono text-[#475569]">
                      ฿{formatCurrency(summary.grandPartsTotal)}
                    </TableCell>
                    <TableCell className="text-right font-bold font-mono text-[#475569]">
                      ฿{formatCurrency(summary.grandSubtotal)}
                    </TableCell>
                    <TableCell className="text-right font-bold font-mono text-[#0d9488] text-sm">
                      ฿{formatCurrency(summary.grandTotalAmount)}
                    </TableCell>
                    <TableCell className="font-bold font-mono text-xs text-[#0d9488]">
                      100.0%
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
