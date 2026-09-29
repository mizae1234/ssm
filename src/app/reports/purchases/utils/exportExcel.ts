import { formatDate } from '@/lib/date'
import { PO_STATUS_CONFIG, PO_TYPE_CONFIG } from '../constants'
import { PurchaseReportResponse } from '../types'

export interface ExportPurchaseExcelParams {
  data: PurchaseReportResponse
  dateFrom: string
  dateTo: string
}

export async function exportPurchaseReportExcel({
  data,
  dateFrom,
  dateTo,
}: ExportPurchaseExcelParams): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  // ══════════════════════════════════════════════════════════
  // SHEET 1: ยอดรวมตามผู้ขาย (Summary by Vendor)
  // ══════════════════════════════════════════════════════════
  const summaryRows = data.byVendor.map((v, i) => ({
    'ลำดับ': i + 1,
    'รหัสผู้ขาย': v.vendorCode || v.vendorId,
    'ชื่อผู้ขาย': v.vendorName,
    'ประเภท': v.vendorType === 'PARTS' ? 'อะไหล่' : 'อู่',
    'เลขประจำตัวผู้เสียภาษี': v.taxId || '-',
    'เครดิตเทอม (วัน)': v.paymentTerms ?? 30,
    'จำนวน PO': v.poCount,
    'จำนวนชิ้น/รายการ': v.itemCount,
    'ยอดก่อน VAT (บาท)': v.subtotal,
    'ยอดรวมสุทธิ (บาท)': v.totalAmount,
    'สัดส่วน (%)': v.percentage,
  }))

  // Grand Total Summary Row for Sheet 1
  summaryRows.push({
    'ลำดับ': '' as any,
    'รหัสผู้ขาย': 'รวมทั้งสิ้น' as any,
    'ชื่อผู้ขาย': `${data.byVendor.length} เจ้า`,
    'ประเภท': '',
    'เลขประจำตัวผู้เสียภาษี': '',
    'เครดิตเทอม (วัน)': '' as any,
    'จำนวน PO': data.summary.totalPOs,
    'จำนวนชิ้น/รายการ': data.summary.totalItems,
    'ยอดก่อน VAT (บาท)': data.summary.grandSubtotal,
    'ยอดรวมสุทธิ (บาท)': data.summary.grandTotalAmount,
    'สัดส่วน (%)': 100.0 as any,
  })

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
  wsSummary['!cols'] = [
    { wch: 6 },  // ลำดับ
    { wch: 14 }, // รหัสผู้ขาย
    { wch: 35 }, // ชื่อผู้ขาย
    { wch: 12 }, // ประเภท
    { wch: 18 }, // เลขผู้เสียภาษี
    { wch: 14 }, // เครดิตเทอม
    { wch: 12 }, // จำนวน PO
    { wch: 16 }, // จำนวนชิ้น
    { wch: 18 }, // ยอดก่อน VAT
    { wch: 18 }, // ยอดรวมสุทธิ
    { wch: 12 }, // สัดส่วน
  ]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'ยอดรวมตามผู้ขาย')

  // ══════════════════════════════════════════════════════════
  // SHEET 2: รายละเอียดการสั่งซื้อ (PO & Items Detail)
  // ══════════════════════════════════════════════════════════
  const detailRows: any[] = []
  let itemSeq = 1

  for (const po of data.details) {
    const statusLabel = PO_STATUS_CONFIG[po.status]?.excelLabel || po.status
    const typeLabel = PO_TYPE_CONFIG[po.poType]?.excelLabel || po.poType

    if (po.items && po.items.length > 0) {
      for (const it of po.items) {
        detailRows.push({
          'ลำดับ': itemSeq++,
          'วันที่สั่งซื้อ': formatDate(po.createdAt),
          'เลขที่ PO': po.poNo,
          'สถานะ PO': statusLabel,
          'ประเภท PO': typeLabel,
          'รหัสผู้ขาย': po.vendor?.peakVendorCode || po.vendor?.id,
          'ชื่อผู้ขาย': po.vendor?.name || '-',
          'เลขที่เคลม': po.claim?.claimNo || '-',
          'ทะเบียนรถ': po.claim?.carPlate || '-',
          'ยี่ห้อ/รุ่น': [po.claim?.carBrand, po.claim?.carModel].filter(Boolean).join(' ') || '-',
          'บริษัทประกัน': po.claim?.insuranceName || '-',
          'รหัสอะไหล่': it.partNo || '-',
          'รายการสินค้า/อะไหล่': it.description || '-',
          'จำนวน': it.quantity,
          'ราคาต่อหน่วย': it.unitPrice,
          'ส่วนลด (%)': it.discountPct,
          'ราคารวมรายการ (บาท)': it.totalPrice,
          'ยอดรวม PO ทั้งใบ (บาท)': po.totalAmount,
        })
      }
    } else {
      detailRows.push({
        'ลำดับ': itemSeq++,
        'วันที่สั่งซื้อ': formatDate(po.createdAt),
        'เลขที่ PO': po.poNo,
        'สถานะ PO': statusLabel,
        'ประเภท PO': typeLabel,
        'รหัสผู้ขาย': po.vendor?.peakVendorCode || po.vendor?.id,
        'ชื่อผู้ขาย': po.vendor?.name || '-',
        'เลขที่เคลม': po.claim?.claimNo || '-',
        'ทะเบียนรถ': po.claim?.carPlate || '-',
        'ยี่ห้อ/รุ่น': [po.claim?.carBrand, po.claim?.carModel].filter(Boolean).join(' ') || '-',
        'บริษัทประกัน': po.claim?.insuranceName || '-',
        'รหัสอะไหล่': '-',
        'รายการสินค้า/อะไหล่': 'ไม่มีรายการย่อย',
        'จำนวน': 1,
        'ราคาต่อหน่วย': po.totalAmount,
        'ส่วนลด (%)': 0,
        'ราคารวมรายการ (บาท)': po.totalAmount,
        'ยอดรวม PO ทั้งใบ (บาท)': po.totalAmount,
      })
    }
  }

  // Grand Total Summary Row for Sheet 2
  detailRows.push({
    'ลำดับ': '' as any,
    'วันที่สั่งซื้อ': 'รวมทั้งสิ้น' as any,
    'เลขที่ PO': `${data.summary.totalPOs} ใบ`,
    'สถานะ PO': '',
    'ประเภท PO': '',
    'รหัสผู้ขาย': '',
    'ชื่อผู้ขาย': `${data.summary.totalVendors} เจ้า`,
    'เลขที่เคลม': '',
    'ทะเบียนรถ': '',
    'ยี่ห้อ/รุ่น': '',
    'บริษัทประกัน': '',
    'รหัสอะไหล่': '',
    'รายการสินค้า/อะไหล่': `${data.summary.totalItems} รายการ`,
    'จำนวน': data.summary.totalItems,
    'ราคาต่อหน่วย': '' as any,
    'ส่วนลด (%)': '' as any,
    'ราคารวมรายการ (บาท)': data.summary.grandSubtotal,
    'ยอดรวม PO ทั้งใบ (บาท)': data.summary.grandTotalAmount,
  })

  const wsDetail = XLSX.utils.json_to_sheet(detailRows)
  wsDetail['!cols'] = [
    { wch: 6 },  // ลำดับ
    { wch: 14 }, // วันที่สั่งซื้อ
    { wch: 18 }, // เลขที่ PO
    { wch: 14 }, // สถานะ PO
    { wch: 12 }, // ประเภท
    { wch: 14 }, // รหัสผู้ขาย
    { wch: 30 }, // ชื่อผู้ขาย
    { wch: 22 }, // เลขที่เคลม
    { wch: 12 }, // ทะเบียนรถ
    { wch: 22 }, // ยี่ห้อ/รุ่น
    { wch: 26 }, // บริษัทประกัน
    { wch: 18 }, // รหัสอะไหล่
    { wch: 36 }, // รายการสินค้า/อะไหล่
    { wch: 10 }, // จำนวน
    { wch: 14 }, // ราคาต่อหน่วย
    { wch: 12 }, // ส่วนลด (%)
    { wch: 18 }, // ราคารวมรายการ
    { wch: 20 }, // ยอดรวม PO
  ]
  XLSX.utils.book_append_sheet(wb, wsDetail, 'รายละเอียดการสั่งซื้อ')

  const filename = `รายงานยอดสั่งซื้อ_${dateFrom}_${dateTo}.xlsx`
  XLSX.writeFile(wb, filename)
}
