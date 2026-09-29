export type POStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'CANCELLED'
export type POType = 'PARTS' | 'LABOR'
export type VendorType = 'PARTS' | 'GARAGE'

export interface VendorInfo {
  id: string
  name: string
  vendorType: VendorType
  taxId: string
  peakVendorCode?: string
  paymentTerms: number
}

export interface ClaimInfo {
  id: string
  claimNo: string
  carPlate: string
  carBrand?: string
  carModel?: string
  insuredName?: string
  insuranceName: string
}

export interface POItemInfo {
  id: string
  partNo: string
  description: string
  quantity: number
  unitPrice: number
  discountPct: number
  totalPrice: number
}

export interface PurchaseOrderDetail {
  id: string
  poNo: string
  createdAt: string
  status: POStatus
  poType: POType
  deliveryMode?: string
  deliveryAddress?: string | null
  totalAmount: number
  subtotal: number
  vatAmount: number
  vendor: VendorInfo
  claim: ClaimInfo
  items: POItemInfo[]
}

export interface VendorPurchaseSummary {
  vendorId: string
  vendorCode: string
  vendorName: string
  vendorType: VendorType
  taxId: string
  paymentTerms: number
  poCount: number
  itemCount: number
  subtotal: number
  totalAmount: number
  percentage: number
}

export interface PurchaseReportSummary {
  totalPOs: number
  totalVendors: number
  totalItems: number
  grandSubtotal: number
  grandTotalAmount: number
  dateFrom: string
  dateTo: string
}

export interface PurchaseReportResponse {
  summary: PurchaseReportSummary
  byVendor: VendorPurchaseSummary[]
  details: PurchaseOrderDetail[]
}

export interface FlattenedItemRow {
  seq: number
  poId: string
  poNo: string
  poDate: string
  status: POStatus
  poType: POType
  vendorName: string
  vendorCode: string
  vendorType: VendorType
  taxId: string
  claimNo: string
  carPlate: string
  carBrandModel: string
  insuranceName: string
  partNo: string
  description: string
  quantity: number
  unitPrice: number
  discountPct: number
  totalPrice: number
  poTotalAmount: number
}

export interface PurchaseFilterValues {
  dateFrom: string
  dateTo: string
  vendorId: string
  vendorSearch: string
  status: string
  poType: string
  search: string
}
