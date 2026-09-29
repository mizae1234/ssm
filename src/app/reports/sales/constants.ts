import { ARInvoiceStatus } from './types'

export const AR_STATUS_CONFIG: Record<
  ARInvoiceStatus,
  { label: string; badgeClass: string; excelLabel: string }
> = {
  PENDING: {
    label: 'รอวางบิล',
    badgeClass: 'bg-amber-100 text-amber-700 border-none font-medium',
    excelLabel: 'รอวางบิล',
  },
  SENT: {
    label: 'วางบิลแล้ว',
    badgeClass: 'bg-blue-100 text-blue-700 border-none font-medium',
    excelLabel: 'วางบิลแล้ว',
  },
  PARTIAL: {
    label: 'ชำระบางส่วน',
    badgeClass: 'bg-indigo-100 text-indigo-700 border-none font-medium',
    excelLabel: 'ชำระบางส่วน',
  },
  PAID: {
    label: 'ชำระแล้ว',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-none font-medium',
    excelLabel: 'ชำระแล้ว',
  },
  CANCELLED: {
    label: 'ยกเลิก',
    badgeClass: 'bg-red-100 text-red-700 border-none font-medium',
    excelLabel: 'ยกเลิก',
  },
}

export const AR_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'สถานะ: ไม่รวมยกเลิก (Active)' },
  { value: 'ALL', label: 'สถานะ: ทั้งหมด (รวมยกเลิก)' },
  { value: 'SENT', label: 'สถานะ: วางบิลแล้ว' },
  { value: 'PENDING', label: 'สถานะ: รอวางบิล' },
  { value: 'PAID', label: 'สถานะ: ชำระแล้ว' },
  { value: 'PARTIAL', label: 'สถานะ: ชำระบางส่วน' },
  { value: 'CANCELLED', label: 'สถานะ: ยกเลิก' },
]

export const TOP_INSURANCE_COLORS = [
  'bg-[#0d9488]',
  'bg-teal-400',
  'bg-cyan-500',
  'bg-sky-400',
  'bg-indigo-400',
]

export const DEFAULT_PAGE_SIZE = 50
