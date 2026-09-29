import { POStatus, POType, VendorType } from './types'

export const PO_STATUS_CONFIG: Record<
  POStatus,
  { label: string; badgeClass: string; excelLabel: string }
> = {
  RECEIVED: {
    label: 'รับสินค้าแล้ว',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-none font-medium',
    excelLabel: 'รับสินค้าแล้ว',
  },
  SENT: {
    label: 'ส่ง PO แล้ว',
    badgeClass: 'bg-blue-100 text-blue-700 border-none font-medium',
    excelLabel: 'ส่งแล้ว',
  },
  PARTIALLY_RECEIVED: {
    label: 'รับบางส่วน',
    badgeClass: 'bg-amber-100 text-amber-700 border-none font-medium',
    excelLabel: 'รับบางส่วน',
  },
  CANCELLED: {
    label: 'ยกเลิก',
    badgeClass: 'bg-red-100 text-red-700 border-none font-medium',
    excelLabel: 'ยกเลิก',
  },
  DRAFT: {
    label: 'แบบร่าง',
    badgeClass: 'bg-gray-100 text-gray-700 border-none font-medium',
    excelLabel: 'แบบร่าง',
  },
}

export const PO_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'สถานะ: ไม่รวมยกเลิก (Active)' },
  { value: 'ALL', label: 'สถานะ: ทั้งหมด (รวมยกเลิก)' },
  { value: 'RECEIVED', label: 'สถานะ: รับสินค้าแล้ว' },
  { value: 'SENT', label: 'สถานะ: ส่งใบสั่งซื้อแล้ว' },
  { value: 'PARTIALLY_RECEIVED', label: 'สถานะ: รับบางส่วน' },
  { value: 'CANCELLED', label: 'สถานะ: ยกเลิก' },
]

export const PO_TYPE_CONFIG: Record<POType, { label: string; excelLabel: string }> = {
  PARTS: {
    label: 'อะไหล่',
    excelLabel: 'อะไหล่',
  },
  LABOR: {
    label: 'ค่าแรง',
    excelLabel: 'ค่าแรง',
  },
}

export const PO_TYPE_OPTIONS = [
  { value: 'ALL', label: 'ประเภท: ทั้งหมด' },
  { value: 'PARTS', label: 'เฉพาะ อะไหล่' },
  { value: 'LABOR', label: 'เฉพาะ ค่าแรง' },
]

export const VENDOR_TYPE_CONFIG: Record<
  VendorType,
  { label: string; badgeClass: string }
> = {
  PARTS: {
    label: 'อะไหล่',
    badgeClass: 'border-blue-200 text-blue-700 bg-blue-50/50 text-[10px]',
  },
  GARAGE: {
    label: 'อู่ซ่อม',
    badgeClass: 'border-orange-200 text-orange-700 bg-orange-50/50 text-[10px]',
  },
}

export const TOP_VENDOR_COLORS = [
  'bg-[#0d9488]',
  'bg-teal-400',
  'bg-cyan-500',
  'bg-sky-400',
  'bg-indigo-400',
]

export const DEFAULT_PAGE_SIZE = 50
