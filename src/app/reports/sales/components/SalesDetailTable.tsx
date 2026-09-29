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
import { AR_STATUS_CONFIG } from '../constants'
import { ARInvoiceStatus, SalesInvoiceDetail } from '../types'

interface SalesDetailTableProps {
  invoices: SalesInvoiceDetail[]
  loading: boolean
  page: number
  pageSize: number
  onPageChange: (newPage: number) => void
}

export function SalesDetailTable({
  invoices,
  loading,
  page,
  pageSize,
  onPageChange,
}: SalesDetailTableProps) {
  const totalPages = Math.ceil(invoices.length / pageSize) || 1
  const paginatedInvoices = invoices.slice((page - 1) * pageSize, page * pageSize)

  const renderStatusBadge = (st: ARInvoiceStatus) => {
    const config = AR_STATUS_CONFIG[st] || {
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
            รายละเอียดใบวางบิลและรายการเคลม (Sales Invoice Details)
          </CardTitle>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            แสดงรายละเอียดใบวางบิลและเคลม (Sheet 2 ในไฟล์ Excel)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748b]">
            พบ {invoices.length.toLocaleString()} ใบวางบิล
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="p-6">
            <SkeletonTableRows rows={10} cols={10} />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 text-[#94a3b8]">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#0d9488]" />
            <p className="text-sm font-medium">ไม่พบรายการวางบิลตามเงื่อนไขที่เลือก</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f8faff] hover:bg-[#f8faff]">
                    <TableHead className="w-12 text-center text-xs font-semibold">#</TableHead>
                    <TableHead className="text-xs font-semibold">วันที่วางบิล</TableHead>
                    <TableHead className="text-xs font-semibold">เลขที่ Invoice</TableHead>
                    <TableHead className="text-center text-xs font-semibold">สถานะ</TableHead>
                    <TableHead className="text-xs font-semibold">บริษัทประกัน</TableHead>
                    <TableHead className="text-xs font-semibold">เคลม / ทะเบียนรถ</TableHead>
                    <TableHead className="text-xs font-semibold">ผู้เอาประกัน</TableHead>
                    <TableHead className="text-right text-xs font-semibold">ค่าอะไหล่</TableHead>
                    <TableHead className="text-right text-xs font-semibold">ยอดก่อน VAT</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-[#0d9488]">
                      ยอดสุทธิ (฿)
                    </TableHead>
                    <TableHead className="text-center text-xs font-semibold">ครบกำหนด</TableHead>
                    <TableHead className="text-center text-xs font-semibold">การชำระ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map((inv, index) => {
                    const globalIndex = (page - 1) * pageSize + index + 1
                    const primaryClaim = inv.claims[0]
                    const otherClaimsCount = inv.claims.length - 1

                    return (
                      <TableRow
                        key={inv.id}
                        className="hover:bg-blue-50/20 text-xs"
                      >
                        <TableCell className="text-center text-[#94a3b8]">{globalIndex}</TableCell>
                        <TableCell className="font-mono text-[#64748b] whitespace-nowrap">
                          {formatDate(inv.invoiceDate)}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-semibold text-[#0d9488] whitespace-nowrap">
                            {inv.invoiceNo}
                          </span>
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          {renderStatusBadge(inv.status)}
                        </TableCell>
                        <TableCell
                          className="font-medium text-[#0f172a] max-w-[180px] truncate"
                          title={inv.insurance?.name}
                        >
                          {inv.insurance?.name}
                        </TableCell>
                        <TableCell>
                          {primaryClaim ? (
                            <div>
                              <div className="font-mono font-medium text-[#0f172a]">
                                {primaryClaim.claimNo}
                                {otherClaimsCount > 0 && (
                                  <span className="ml-1 text-[10px] text-teal-600 bg-teal-50 px-1 rounded">
                                    +{otherClaimsCount}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#64748b]">
                                {primaryClaim.carPlate} {primaryClaim.carBrand && `(${primaryClaim.carBrand})`}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[#94a3b8]">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[#64748b] max-w-[120px] truncate">
                          {primaryClaim?.insuredName || '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[#64748b]">
                          ฿{formatCurrency(inv.partsTotal)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[#475569]">
                          ฿{formatCurrency(inv.subtotal)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-[#0d9488] whitespace-nowrap">
                          ฿{formatCurrency(inv.grandTotal)}
                        </TableCell>
                        <TableCell className="text-center font-mono text-[#64748b] whitespace-nowrap">
                          {formatDate(inv.dueDate)}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          {inv.isPaid ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                              ชำระแล้ว
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                              รอรับชำระ
                            </Badge>
                          )}
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
                  {invoices.length.toLocaleString()} ใบวางบิล)
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
