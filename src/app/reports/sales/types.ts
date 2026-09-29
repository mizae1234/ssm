export type ARInvoiceStatus = 'PENDING' | 'SENT' | 'PARTIAL' | 'PAID' | 'CANCELLED'

export interface InsuranceInfo {
  id: string
  name: string
  taxId: string
  peakCustomerId: string
  creditTermDays: number
}

export interface InvoiceClaimItem {
  id: string
  claimNo: string
  carPlate: string
  carBrand?: string
  carModel?: string
  insuredName?: string
}

export interface SalesInvoiceDetail {
  id: string
  invoiceNo: string
  invoiceDate: string
  dueDate: string | null
  status: ARInvoiceStatus
  partsTotal: number
  laborTotal: number
  subtotal: number
  vatAmount: number
  grandTotal: number
  deductible: number
  insurance: InsuranceInfo
  claims: InvoiceClaimItem[]
  isPaid: boolean
  paidAmount?: number
  paidDate?: string
}

export interface InsuranceSalesSummary {
  insuranceId: string
  insuranceCode: string
  insuranceName: string
  taxId: string
  creditTermDays: number
  invoiceCount: number
  claimCount: number
  partsTotal: number
  laborTotal: number
  subtotal: number
  vatAmount: number
  grandTotal: number
  percentage: number
}

export interface SalesReportSummary {
  totalInvoices: number
  totalClaims: number
  totalInsurances: number
  grandPartsTotal: number
  grandLaborTotal: number
  grandSubtotal: number
  grandVatAmount: number
  grandTotalAmount: number
  dateFrom: string
  dateTo: string
}

export interface SalesReportResponse {
  summary: SalesReportSummary
  byInsurance: InsuranceSalesSummary[]
  details: SalesInvoiceDetail[]
}

export interface SalesFilterValues {
  dateFrom: string
  dateTo: string
  insuranceId: string
  insuranceSearch: string
  status: string
  search: string
}
