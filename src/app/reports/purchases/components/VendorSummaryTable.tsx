"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonTableRows } from '@/components/ui/skeleton'
import { ShoppingCart, ArrowRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { VENDOR_TYPE_CONFIG } from '../constants'
import { PurchaseReportSummary, VendorPurchaseSummary } from '../types'

interface VendorSummaryTableProps {
  vendors: VendorPurchaseSummary[]
  summary: PurchaseReportSummary | null | undefined
  loading: boolean
  selectedVendorId?: string
  onSelectVendor: (vendorId: string) => void
  onClearVendorFilter: () => void
}

export function VendorSummaryTable({
  vendors,
  summary,
  loading,
  selectedVendorId,
  onSelectVendor,
  onClearVendorFilter,
}: VendorSummaryTableProps) {
  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="py-4 px-6 flex flex-row items-center justify-between border-b border-gray-100">
        <div>
          <CardTitle className="text-base font-bold text-[#0f172a]">
            สรุปยอดสั่งซื้อแยกตามผู้ขาย (Vendor Summary)
          </CardTitle>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            เรียงตามมูลค่าการสั่งซื้อสุทธิสูงสุด (Sheet 1 ในไฟล์ Excel)
          </p>
        </div>

        {selectedVendorId && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-xs">
              กำลังแสดงเฉพาะผู้ขายที่เลือก
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearVendorFilter}
              className="h-7 text-xs text-[#0d9488]"
            >
              แสดงทุกเจ้า
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="p-6">
            <SkeletonTableRows rows={8} cols={9} />
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-16 text-[#94a3b8]">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#0d9488]" />
            <p className="text-sm font-medium">ไม่พบข้อมูลการสั่งซื้อในช่วงเวลาที่เลือก</p>
            <p className="text-xs text-[#cbd5e1] mt-1">ลองเปลี่ยนช่วงเวลาหรือปรับตัวกรอง</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f8faff] hover:bg-[#f8faff]">
                  <TableHead className="w-12 text-center text-xs font-semibold">#</TableHead>
                  <TableHead className="text-xs font-semibold">รหัสผู้ขาย</TableHead>
                  <TableHead className="text-xs font-semibold">ชื่อผู้ขาย (Vendor)</TableHead>
                  <TableHead className="text-center text-xs font-semibold">ประเภท</TableHead>
                  <TableHead className="text-center text-xs font-semibold">เครดิต (วัน)</TableHead>
                  <TableHead className="text-center text-xs font-semibold">จำนวน PO</TableHead>
                  <TableHead className="text-center text-xs font-semibold">จำนวนชิ้น</TableHead>
                  <TableHead className="text-right text-xs font-semibold">ยอดก่อน VAT</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-[#0d9488]">
                    ยอดรวมสุทธิ (฿)
                  </TableHead>
                  <TableHead className="w-40 text-left text-xs font-semibold">สัดส่วน (%)</TableHead>
                  <TableHead className="w-24 text-center text-xs font-semibold">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((v, i) => {
                  const typeConfig = VENDOR_TYPE_CONFIG[v.vendorType] || {
                    label: v.vendorType,
                    badgeClass: 'border-gray-200 text-gray-700 text-[10px]',
                  }

                  return (
                    <TableRow
                      key={v.vendorId}
                      className="hover:bg-teal-50/30 transition-colors"
                    >
                      <TableCell className="text-center text-xs text-[#94a3b8]">{i + 1}</TableCell>
                      <TableCell className="text-xs font-mono text-[#64748b]">
                        {v.vendorCode || v.vendorId}
                      </TableCell>
                      <TableCell>
                        <div
                          className="font-semibold text-xs text-[#0f172a] hover:text-[#0d9488] cursor-pointer"
                          onClick={() => onSelectVendor(v.vendorId)}
                        >
                          {v.vendorName}
                        </div>
                        <div className="text-[11px] text-[#94a3b8] font-mono">
                          Tax ID: {v.taxId || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={typeConfig.badgeClass}>
                          {typeConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs text-[#475569]">
                        {v.paymentTerms} วัน
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => onSelectVendor(v.vendorId)}
                          className="inline-flex items-center gap-1 font-semibold text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full"
                        >
                          {v.poCount} ใบ
                        </button>
                      </TableCell>
                      <TableCell className="text-center text-xs text-[#475569]">
                        {v.itemCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-[#475569]">
                        ฿{formatCurrency(v.subtotal)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold font-mono text-[#0d9488]">
                        ฿{formatCurrency(v.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold font-mono text-[#0f172a]">
                              {v.percentage}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#0d9488] to-teal-400 rounded-full"
                              style={{ width: `${Math.min(v.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSelectVendor(v.vendorId)}
                          className="h-7 px-2 text-xs text-[#0d9488] hover:text-[#0f766e] hover:bg-teal-50 gap-1"
                        >
                          <span>ดูรายการ</span>
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}

                {/* Summary Grand Total Row */}
                {summary && (
                  <TableRow className="bg-[#f0fdfa] font-bold border-t-2 border-[#0d9488] text-xs">
                    <TableCell colSpan={2} className="text-center font-bold text-[#0f172a]">
                      รวมทั้งสิ้น
                    </TableCell>
                    <TableCell className="font-bold text-[#0d9488]">
                      {vendors.length} เจ้า
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                    <TableCell className="text-center font-bold font-mono text-blue-700">
                      {summary.totalPOs} ใบ
                    </TableCell>
                    <TableCell className="text-center font-bold font-mono text-[#0f172a]">
                      {summary.totalItems.toLocaleString()} ชิ้น
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
