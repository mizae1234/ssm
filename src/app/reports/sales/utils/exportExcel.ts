import { formatDate } from '@/lib/date'
import { AR_STATUS_CONFIG } from '../constants'
import { SalesReportResponse } from '../types'

export interface ExportSalesExcelParams {
  data: SalesReportResponse
  dateFrom: string
  dateTo: string
}

export async function exportSalesReportExcel({
  data,
  dateFrom,
  dateTo,
}: ExportSalesExcelParams): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  // ══════════════════════════════════════════════════════════
  // SHEET 1: ยอดรวมตามบริษัทประกัน (Sales Summary by Insurance)
  // ══════════════════════════════════════════════════════════
  const summaryRows = data.byInsurance.map((ins, i) => ({
    'ลำดับ': i + 1,
    'รหัสลูกค้า': ins.insuranceCode || ins.insuranceId,
    'ชื่อบริษัทประกัน': ins.insuranceName,
    'เลขประจำตัวผู้เสียภาษี': ins.taxId || '-',
    'เครดิตเทอม (วัน)': ins.creditTermDays ?? 30,
    'จำนวน Invoice (ใบ)': ins.invoiceCount,
    'จำนวนเคลม (เคส)': ins.claimCount,
    'ค่าอะไหล่รวม (บาท)': ins.partsTotal,
    'ค่าแรงรวม (บาท)': ins.laborTotal,
    'ยอดก่อน VAT (บาท)': ins.subtotal,
    'ภาษี (VAT 7%)': ins.vatAmount,
    'ยอดขายรวมสุทธิ (บาท)': ins.grandTotal,
    'สัดส่วน (%)': ins.percentage,
  }))

  // Grand Total Summary Row for Sheet 1
  summaryRows.push({
    'ลำดับ': '' as any,
    'รหัสลูกค้า': 'รวมทั้งสิ้น' as any,
    'ชื่อบริษัทประกัน': `${data.byInsurance.length} บริษัท`,
    'เลขประจำตัวผู้เสียภาษี': '',
    'เครดิตเทอม (วัน)': '' as any,
    'จำนวน Invoice (ใบ)': data.summary.totalInvoices,
    'จำนวนเคลม (เคส)': data.summary.totalClaims,
    'ค่าอะไหล่รวม (บาท)': data.summary.grandPartsTotal,
    'ค่าแรงรวม (บาท)': data.summary.grandLaborTotal,
    'ยอดก่อน VAT (บาท)': data.summary.grandSubtotal,
    'ภาษี (VAT 7%)': data.summary.grandVatAmount,
    'ยอดขายรวมสุทธิ (บาท)': data.summary.grandTotalAmount,
    'สัดส่วน (%)': 100.0 as any,
  })

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
  wsSummary['!cols'] = [
    { wch: 6 },  // ลำดับ
    { wch: 14 }, // รหัสลูกค้า
    { wch: 38 }, // ชื่อบริษัทประกัน
    { wch: 18 }, // เลขผู้เสียภาษี
    { wch: 14 }, // เครดิตเทอม
    { wch: 16 }, // จำนวน Invoice
    { wch: 16 }, // จำนวนเคลม
    { wch: 18 }, // ค่าอะไหล่รวม
    { wch: 16 }, // ค่าแรงรวม
    { wch: 18 }, // ยอดก่อน VAT
    { wch: 16 }, // ภาษี VAT
    { wch: 20 }, // ยอดขายรวมสุทธิ
    { wch: 12 }, // สัดส่วน
  ]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'ยอดรวมตามบริษัทประกัน')

  // ══════════════════════════════════════════════════════════
  // SHEET 2: รายละเอียดการวางบิล (Invoice & Claims Detail)
  // ══════════════════════════════════════════════════════════
  const detailRows: any[] = []
  let rowSeq = 1

  for (const inv of data.details) {
    const statusLabel = AR_STATUS_CONFIG[inv.status]?.excelLabel || inv.status

    if (inv.claims && inv.claims.length > 0) {
      for (const c of inv.claims) {
        detailRows.push({
          'ลำดับ': rowSeq++,
          'วันที่วางบิล': formatDate(inv.invoiceDate),
          'เลขที่ Invoice': inv.invoiceNo,
          'สถานะ Invoice': statusLabel,
          'รหัสลูกค้า': inv.insurance?.peakCustomerId || inv.insurance?.id,
          'ชื่อบริษัทประกัน': inv.insurance?.name || '-',
          'เลขที่เคลม': c.claimNo || '-',
          'ทะเบียนรถ': c.carPlate || '-',
          'ยี่ห้อ/รุ่น': [c.carBrand, c.carModel].filter(Boolean).join(' ') || '-',
          'ผู้เอาประกัน': c.insuredName || '-',
          'ค่าอะไหล่ (บาท)': inv.partsTotal,
          'ค่าแรง (บาท)': inv.laborTotal,
          'ยอดก่อน VAT (บาท)': inv.subtotal,
          'ภาษี VAT (บาท)': inv.vatAmount,
          'ยอดรวมสุทธิ (บาท)': inv.grandTotal,
          'วันครบกำหนดชำระ': formatDate(inv.dueDate),
          'สถานะรับเงิน': inv.isPaid ? 'ชำระแล้ว' : 'ค้างชำระ',
        })
      }
    } else {
      detailRows.push({
        'ลำดับ': rowSeq++,
        'วันที่วางบิล': formatDate(inv.invoiceDate),
        'เลขที่ Invoice': inv.invoiceNo,
        'สถานะ Invoice': statusLabel,
        'รหัสลูกค้า': inv.insurance?.peakCustomerId || inv.insurance?.id,
        'ชื่อบริษัทประกัน': inv.insurance?.name || '-',
        'เลขที่เคลม': '-',
        'ทะเบียนรถ': '-',
        'ยี่ห้อ/รุ่น': '-',
        'ผู้เอาประกัน': '-',
        'ค่าอะไหล่ (บาท)': inv.partsTotal,
        'ค่าแรง (บาท)': inv.laborTotal,
        'ยอดก่อน VAT (บาท)': inv.subtotal,
        'ภาษี VAT (บาท)': inv.vatAmount,
        'ยอดรวมสุทธิ (บาท)': inv.grandTotal,
        'วันครบกำหนดชำระ': formatDate(inv.dueDate),
        'สถานะรับเงิน': inv.isPaid ? 'ชำระแล้ว' : 'ค้างชำระ',
      })
    }
  }

  // Grand Total Summary Row for Sheet 2
  detailRows.push({
    'ลำดับ': '' as any,
    'วันที่วางบิล': 'รวมทั้งสิ้น' as any,
    'เลขที่ Invoice': `${data.summary.totalInvoices} ใบ`,
    'สถานะ Invoice': '',
    'รหัสลูกค้า': '',
    'ชื่อบริษัทประกัน': `${data.summary.totalInsurances} บริษัท`,
    'เลขที่เคลม': `${data.summary.totalClaims} เคลม`,
    'ทะเบียนรถ': '',
    'ยี่ห้อ/รุ่น': '',
    'ผู้เอาประกัน': '',
    'ค่าอะไหล่ (บาท)': data.summary.grandPartsTotal,
    'ค่าแรง (บาท)': data.summary.grandLaborTotal,
    'ยอดก่อน VAT (บาท)': data.summary.grandSubtotal,
    'ภาษี VAT (บาท)': data.summary.grandVatAmount,
    'ยอดรวมสุทธิ (บาท)': data.summary.grandTotalAmount,
    'วันครบกำหนดชำระ': '',
    'สถานะรับเงิน': '',
  })

  const wsDetail = XLSX.utils.json_to_sheet(detailRows)
  wsDetail['!cols'] = [
    { wch: 6 },  // ลำดับ
    { wch: 14 }, // วันที่วางบิล
    { wch: 18 }, // เลขที่ Invoice
    { wch: 14 }, // สถานะ Invoice
    { wch: 14 }, // รหัสลูกค้า
    { wch: 34 }, // บริษัทประกัน
    { wch: 22 }, // เลขที่เคลม
    { wch: 12 }, // ทะเบียนรถ
    { wch: 20 }, // ยี่ห้อ/รุ่น
    { wch: 20 }, // ผู้เอาประกัน
    { wch: 16 }, // ค่าอะไหล่
    { wch: 14 }, // ค่าแรง
    { wch: 16 }, // ยอดก่อน VAT
    { wch: 14 }, // ภาษี VAT
    { wch: 18 }, // ยอดรวมสุทธิ
    { wch: 16 }, // วันครบกำหนด
    { wch: 14 }, // สถานะรับเงิน
  ]
  XLSX.utils.book_append_sheet(wb, wsDetail, 'รายละเอียดการวางบิล')

  const filename = `รายงานยอดขาย_${dateFrom}_${dateTo}.xlsx`
  XLSX.writeFile(wb, filename)
}
