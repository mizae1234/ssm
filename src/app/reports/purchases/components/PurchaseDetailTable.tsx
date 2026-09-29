"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonTableRows } from '@/components/ui/skeleton'
import { FileSpreadsheet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { formatDate } from '@/lib/date'
import { PO_STATUS_CONFIG } from '../constants'
import { FlattenedItemRow, POStatus } from '../types'

interface PurchaseDetailTableProps {
  items: FlattenedItemRow[]
  loading: boolean
  page: number
  pageSize: number
  onPageChange: (newPage: number) => void
}

export function PurchaseDetailTable({
  items,
  loading,
  page,
  pageSize,
  onPageChange,
}: PurchaseDetailTableProps) {
  const totalPages = Math.ceil(items.length / pageSize) || 1
  const paginatedItems = items.slice((page - 1) * pageSize, page * pageSize)

  const renderStatusBadge = (st: POStatus) => {
    const config = PO_STATUS_CONFIG[st] || {
      label: st,
      badgeClass: 'bg-gray-100 text-gray-700',
    }
    return <Badge className={config.badgeClass}>{config.label}</Badge>
  }

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="py-4 px-6 flex flex-row items-center justify-between border-b border-gray-100">
        <div>
          <CardTitle className="text-base font-bold text-[#0f172a]">
            รายละเอียดใบสั่งซื้อและรายการสินค้า (Purchase Order Details)
          </CardTitle>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            แสดงรายการแยกตามสินค้า/อะไหล่ พร้อมยอดรวม PO (Sheet 2 ในไฟล์ Excel)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748b]">
            พบ {items.length.toLocaleString()} รายการ
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="p-6">
            <SkeletonTableRows rows={10} cols={10} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-[#94a3b8]">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#0d9488]" />
            <p className="text-sm font-medium">ไม่พบรายการสั่งซื้อตามเงื่อนไขที่เลือก</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f8faff] hover:bg-[#f8faff]">
                    <TableHead className="w-12 text-center text-xs font-semibold">#</TableHead>
                    <TableHead className="text-xs font-semibold">วันที่สั่งซื้อ</TableHead>
                    <TableHead className="text-xs font-semibold">เลขที่ PO</TableHead>
                    <TableHead className="text-center text-xs font-semibold">สถานะ</TableHead>
                    <TableHead className="text-xs font-semibold">ผู้ขาย (Vendor)</TableHead>
                    <TableHead className="text-xs font-semibold">เคลม / ทะเบียนรถ</TableHead>
                    <TableHead className="text-xs font-semibold">บ.ประกัน</TableHead>
                    <TableHead className="text-xs font-semibold">รหัส / รายการสินค้า</TableHead>
                    <TableHead className="text-center text-xs font-semibold">จำนวน</TableHead>
                    <TableHead className="text-right text-xs font-semibold">ราคา/หน่วย</TableHead>
                    <TableHead className="text-center text-xs font-semibold">ลด (%)</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-[#0f172a]">
                      ราคารายการ
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-[#0d9488]">
                      ยอดรวม PO
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item, index) => {
                    const globalIndex = (page - 1) * pageSize + index + 1
                    return (
                      <TableRow
                        key={`${item.poId}-${index}`}
                        className="hover:bg-blue-50/20 text-xs"
                      >
                        <TableCell className="text-center text-[#94a3b8]">{globalIndex}</TableCell>
                        <TableCell className="font-mono text-[#64748b] whitespace-nowrap">
                          {formatDate(item.poDate)}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-semibold text-[#0d9488] whitespace-nowrap">
                            {item.poNo}
                          </span>
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          {renderStatusBadge(item.status)}
                        </TableCell>
                        <TableCell
                          className="font-medium text-[#0f172a] max-w-[180px] truncate"
                          title={item.vendorName}
                        >
                          {item.vendorName}
                        </TableCell>
                        <TableCell>
                          <div className="font-mono font-medium text-[#0f172a]">{item.claimNo}</div>
                          <div className="text-[11px] text-[#64748b]">{item.carPlate}</div>
                        </TableCell>
                        <TableCell
                          className="text-[#64748b] max-w-[140px] truncate"
                          title={item.insuranceName}
                        >
                          {item.insuranceName}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <div className="text-[#0f172a] font-medium truncate" title={item.description}>
                            {item.description}
                          </div>
                          {item.partNo && item.partNo !== '-' && (
                            <div className="text-[11px] font-mono text-[#94a3b8]">{item.partNo}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono font-semibold text-[#0f172a]">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[#64748b]">
                          ฿{formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-center font-mono text-[#64748b]">
                          {item.discountPct > 0 ? `${item.discountPct}%` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-[#0f172a]">
                          ฿{formatCurrency(item.totalPrice)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-[#0d9488] whitespace-nowrap">
                          ฿{formatCurrency(item.poTotalAmount)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-[#f8faff]">
                <div className="text-xs text-[#64748b]">
                  แสดงหน้า <span className="font-semibold text-[#0f172a]">{page}</span> จาก{' '}
                  <span className="font-semibold text-[#0f172a]">{totalPages}</span> (ทั้งหมด{' '}
                  {items.length.toLocaleString()} รายการ)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    className="h-8 text-xs"
                  >
                    ก่อนหน้า
                  </Button>
                  <span className="text-xs font-mono font-semibold px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                    className="h-8 text-xs"
                  >
                    ถัดไป
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
