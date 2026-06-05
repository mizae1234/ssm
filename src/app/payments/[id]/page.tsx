'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  ExternalLink, 
  Printer, 
  Info,
  Calendar,
  User,
  CreditCard,
  Building2,
  FileCheck2,
  Image as ImageIcon,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { formatDate, formatDateTime } from '@/lib/date'

const statusColor = (s: string) => {
  if (s === 'APPROVED') return 'bg-green-100 text-green-700 border-green-200'
  if (s === 'REJECTED') return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-amber-100 text-amber-700 border-amber-200'
}

const statusLabel = (s: string) => {
  if (s === 'APPROVED') return 'อนุมัติแล้ว'
  if (s === 'REJECTED') return 'ถูกปฏิเสธ'
  return 'รออนุมัติ'
}

const typeLabel = (t: string) => {
  if (t === 'AP_VENDOR') return 'AP Vendor (จ่ายผู้จัดจำหน่าย)'
  if (t === 'AP_GARAGE') return 'AP อู่ (จ่ายอู่ซ่อม)'
  return 'AR ประกัน (รับเงินบริษัทประกัน)'
}

export default function PaymentRequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [payment, setPayment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Tab control
  const [activeTab, setActiveTab] = useState<string>('invoice')
  
  // Selection states for dynamic files
  const [selectedPoId, setSelectedPoId] = useState<string>('')
  const [selectedGrId, setSelectedGrId] = useState<string>('')
  const [selectedDocUrl, setSelectedDocUrl] = useState<string | null>(null)
  
  // Action form states
  const [rejectReason, setRejectReason] = useState('')
  const [approveNote, setApproveNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [zoomLevel, setZoomLevel] = useState(0.75)
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedArDoc, setSelectedArDoc] = useState<'invoice' | 'delivery-tax' | 'receipt'>('invoice')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/payments/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('ไม่พบข้อมูลคำขออนุมัติจ่ายเงิน')
        return res.json()
      })
      .then(data => {
        setPayment(data)
        
        // Auto-select initial PO & GR if available
        if (data.claim?.purchaseOrders?.length > 0) {
          setSelectedPoId(data.claim.purchaseOrders[0].id)
          const validGRs = data.claim.purchaseOrders[0].goodsReceipts || []
          if (validGRs.length > 0) {
            setSelectedGrId(validGRs[0].id)
          }
        }
        
        // Set initial doc view to first claim attachment if available
        if (data.claim?.documents?.length > 0) {
          setSelectedDocUrl(data.claim.documents[0].fileUrl)
        }
        
        // Prepopulate note/reason
        setApproveNote(data.note || '')
        setRejectReason(data.rejectReason || '')
        
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setError(err.message)
        setLoading(false)
      })
  }, [id])

  const handleApprove = async () => {
    try {
      setIsSaving(true)
      const res = await fetch(`/api/payments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'APPROVED', 
          approvedBy: 'Manager', 
          approvedAt: new Date().toISOString(),
          note: approveNote 
        })
      })
      if (!res.ok) throw new Error('บันทึกการอนุมัติล้มเหลว')
      
      const updated = await res.json()
      setPayment((prev: any) => ({ ...prev, ...updated }))
      showToast('อนุมัติคำขอจ่ายเงินเสร็จสมบูรณ์')
    } catch (err: any) {
      console.error(err)
      showToast(`❌ ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      showToast('⚠️ กรุณาระบุเหตุผลการปฏิเสธ')
      return
    }
    try {
      setIsSaving(true)
      const res = await fetch(`/api/payments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'REJECTED', 
          rejectReason, 
          approvedBy: 'Manager',
          note: approveNote
        })
      })
      if (!res.ok) throw new Error('บันทึกการปฏิเสธล้มเหลว')
      
      const updated = await res.json()
      setPayment((prev: any) => ({ ...prev, ...updated }))
      showToast('ปฏิเสธคำขออนุมัติเรียบร้อย')
    } catch (err: any) {
      console.error(err)
      showToast(`❌ ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Check if file is PDF
  const isPdfFile = (url: string) => {
    if (!url) return false
    const lower = url.toLowerCase()
    return lower.endsWith('.pdf') || lower.includes('.pdf?') || lower.includes('pdf')
  }

  const activePo = useMemo(() => {
    if (!payment?.claim?.purchaseOrders) return null
    return payment.claim.purchaseOrders.find((p: any) => p.id === selectedPoId) || payment.claim.purchaseOrders[0]
  }, [payment, selectedPoId])

  const activeGr = useMemo(() => {
    if (!activePo?.goodsReceipts) return null
    return activePo.goodsReceipts.find((g: any) => g.id === selectedGrId) || activePo.goodsReceipts[0]
  }, [activePo, selectedGrId])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-[#0d9488] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">กำลังโหลดข้อมูลและเตรียมเอกสาร...</p>
      </div>
    )
  }

  if (error || !payment) {
    return (
      <Card className="max-w-md mx-auto mt-12 border-red-100 bg-red-50/50">
        <CardContent className="p-6 text-center space-y-4">
          <XCircle className="w-12 h-12 text-red-500 mx-auto" />
          <div>
            <h3 className="font-bold text-slate-900">เกิดข้อผิดพลาด</h3>
            <p className="text-sm text-slate-500 mt-1">{error || 'ไม่สามารถโหลดข้อมูลคำอนุมัติได้'}</p>
          </div>
          <Button onClick={() => router.push('/payments')} className="w-full bg-slate-800 text-white">
            กลับหน้ารวม
          </Button>
        </CardContent>
      </Card>
    )
  }

  const claim = payment.claim
  const supplierInvoice = payment.supplierInvoice
  const garageInvoice = payment.garageInvoice
  const insuranceInvoice = payment.insuranceInvoice

  // Extract payee details
  const payeeName = payment.vendorName || payment.garageName || payment.insuranceName || 'ไม่ระบุผู้รับเงิน'
  const payeeTaxId = supplierInvoice?.vendor?.taxId || garageInvoice?.garage?.taxId || claim?.insurance?.taxId || '-'
  const payeeBranch = supplierInvoice?.vendor?.branchCode || garageInvoice?.garage?.branchCode || claim?.insurance?.branchCode || '00000'
  const payeeAddress = supplierInvoice?.vendor?.address || garageInvoice?.garage?.address || claim?.insurance?.address || '-'

  // Embeddable Invoice URL
  const uploadInvoiceUrl = supplierInvoice?.pdfUrl || garageInvoice?.pdfUrl || null

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 md:px-4">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-6 right-6 text-white px-6 py-3 rounded-xl shadow-2xl z-50 animate-in slide-in-from-top-4 font-medium flex items-center gap-2 ${toast.includes('❌') || toast.includes('⚠️') ? 'bg-red-600' : 'bg-green-600'}`}>
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/payments">
          <Button variant="ghost" size="icon" className="rounded-full bg-white border shadow-sm">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900">ตรวจสอบรายละเอียดคำขออนุมัติ</h1>
            <Badge className={`${statusColor(payment.status)} border text-xs font-semibold`}>
              {statusLabel(payment.status)}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">ID: {payment.id} • สร้างเมื่อ {formatDateTime(payment.createdAt)}</p>
        </div>
      </div>

      <div className={isExpanded ? "flex flex-col gap-6" : "grid grid-cols-1 lg:grid-cols-3 gap-6"}>
        {/* Left pane: Details & Actions */}
        <div className={isExpanded ? "hidden" : "lg:col-span-1 space-y-6"}>
          {/* Details Card */}
          <Card className="shadow-sm border border-slate-100 bg-white">
            <CardHeader className="bg-slate-50/50 border-b pb-3.5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                <Info className="w-4 h-4 text-teal-600" />
                ข้อมูลคำขออนุมัติ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">ประเภทรายการ</span>
                  <span className="font-semibold text-slate-900">{typeLabel(payment.requestType)}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">เลขที่ใบเคลม</span>
                  <Link href={`/claims/${payment.claimId}`} target="_blank" className="font-bold text-teal-700 hover:underline flex items-center gap-0.5">
                    {payment.claimNo}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">ทะเบียนรถ / ยี่ห้อ</span>
                  <span className="font-medium text-slate-800">{payment.carPlate || '-'} {claim?.carBrand ? `(${claim.carBrand} ${claim.carModel || ''})` : ''}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">ผู้รับเงิน / คู่ค้า</span>
                  <span className="font-bold text-slate-800">{payeeName}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">เลขทะเบียน 13 หลัก / สาขา</span>
                  <span className="font-mono text-slate-700">{payeeTaxId} / {payeeBranch}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">เลขที่ Invoice/บิล</span>
                  <span className="font-mono font-semibold text-slate-800">{payment.invoiceNo || '-'}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">ยอดเงินก่อนภาษี</span>
                  <span className="font-medium text-slate-800">฿{formatCurrency(payment.amount - (payment.vatAmount || 0))}</span>
                </div>
                {payment.vatAmount > 0 && (
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-slate-500">ภาษีมูลค่าเพิ่ม (VAT)</span>
                    <span className="font-medium text-slate-800">฿{formatCurrency(payment.vatAmount)}</span>
                  </div>
                )}
                {payment.whtAmount > 0 && (
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-slate-500">หัก ณ ที่จ่าย (WHT)</span>
                    <span className="font-medium text-red-600">-฿{formatCurrency(payment.whtAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500 font-bold text-slate-700">ยอดสุทธิที่ทำรายการ</span>
                  <span className="font-bold text-sm text-teal-700">฿{formatCurrency(payment.amount - payment.whtAmount)}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">ช่องทางการชำระ</span>
                  <span className="font-medium text-slate-800">{payment.method || 'โอนเงิน'}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">ผู้สร้างคำขอ</span>
                  <span className="font-medium text-slate-800">{payment.createdBy || 'พนักงาน'}</span>
                </div>
                {payment.note && (
                  <div className="space-y-1 pt-1 bg-slate-50 p-2 rounded">
                    <span className="text-slate-500 font-medium block">บันทึกเพิ่มเติม:</span>
                    <p className="text-slate-700 break-words leading-relaxed font-sans">{payment.note}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions Pane */}
          {payment.status === 'PENDING_APPROVAL' ? (
            <Card className="shadow-sm border border-slate-100 bg-white">
              <CardHeader className="bg-slate-50/50 border-b pb-3.5">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                  <FileCheck2 className="w-4 h-4 text-green-600" />
                  การอนุมัติคำขอ
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Approve Note */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">หมายเหตุ (คำชี้แจงในการอนุมัติ - ไม่บังคับ)</label>
                  <Input 
                    placeholder="ใส่ข้อความบันทึกการอนุมัติ..." 
                    value={approveNote}
                    onChange={e => setApproveNote(e.target.value)}
                    className="text-xs"
                    disabled={isSaving}
                  />
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-xs" 
                    onClick={handleApprove}
                    disabled={isSaving}
                  >
                    {isSaving ? 'กำลังดำเนินการ...' : '✅ อนุมัติการชำระเงิน'}
                  </Button>
                </div>

                <hr className="my-4" />

                {/* Reject Reason */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-red-500">เหตุผลในการปฏิเสธคำขอ * (บังคับระบุ)</label>
                  <Input 
                    placeholder="ระบุเหตุผลการปฏิเสธ..." 
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    className="text-xs border-red-200 focus:border-red-500"
                    disabled={isSaving}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Button 
                    variant="destructive" 
                    className="w-full font-bold text-xs" 
                    onClick={handleReject}
                    disabled={!rejectReason.trim() || isSaving}
                  >
                    {isSaving ? 'กำลังดำเนินการ...' : '❌ ปฏิเสธคำขอ'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm border border-slate-100 bg-white">
              <CardHeader className="bg-slate-50/50 border-b pb-3.5">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-slate-600" />
                  ผลการอนุมัติ
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-slate-500">ผู้อนุมัติ/ผู้ปฏิเสธ</span>
                  <span className="font-semibold text-slate-800">{payment.approvedBy || '-'}</span>
                </div>
                {payment.approvedAt && (
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-slate-500">เวลาที่อนุมัติ</span>
                    <span className="font-medium text-slate-800">{formatDateTime(payment.approvedAt)}</span>
                  </div>
                )}
                {payment.status === 'REJECTED' && payment.rejectReason && (
                  <div className="bg-red-50 p-2.5 rounded border border-red-100 space-y-1">
                    <span className="text-red-600 font-bold block">เหตุผลในการปฏิเสธ:</span>
                    <p className="text-slate-700 leading-relaxed font-medium">{payment.rejectReason}</p>
                  </div>
                )}
                {payment.status === 'APPROVED' && payment.paymentId && (
                  <div className="flex justify-between border-b pb-1.5">
                    <span className="text-slate-500">รหัสการจ่ายเงิน (Payment ID)</span>
                    <span className="font-mono font-bold text-teal-700">{payment.paymentId}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right pane: Review Documents (PO, GR, Invoice, Attachments) */}
        <div className={isExpanded ? "w-full animate-fade-in" : "lg:col-span-2"}>
          <Card className="shadow-sm border border-slate-100 h-full flex flex-col bg-white">
            <CardContent className="p-4 flex-1 flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
                <div className="flex items-center justify-between border-b pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                      📄 เอกสารแนบและหลักฐานอ้างอิง
                    </span>
                    
                    {/* Zoom Controls */}
                    {(activeTab === 'po' || activeTab === 'gr' || (activeTab === 'invoice' && payment.requestType === 'AR')) && (
                      <div className="flex items-center gap-1.5 bg-slate-50 p-0.5 rounded-lg border shadow-sm">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 rounded-md hover:bg-slate-100" 
                          onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))}
                          title="Zoom Out"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </Button>
                        <span className="text-[10px] font-bold text-slate-600 min-w-[32px] text-center">
                          {Math.round(zoomLevel * 100)}%
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 rounded-md hover:bg-slate-100" 
                          onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))}
                          title="Zoom In"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-1.5 text-[10px] font-bold hover:bg-slate-100 text-teal-700" 
                          onClick={() => setZoomLevel(0.75)}
                          title="Reset to default fit (75%)"
                        >
                          Fit
                        </Button>
                      </div>
                    )}

                    {/* Expand/Collapse Toggle */}
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-7 w-7 rounded-lg hover:bg-slate-100 flex items-center justify-center border shadow-sm" 
                      onClick={() => setIsExpanded(!isExpanded)}
                      title={isExpanded ? "Collapse to split screen" : "Expand to full screen"}
                    >
                      {isExpanded ? <Minimize2 className="w-4 h-4 text-slate-600" /> : <Maximize2 className="w-4 h-4 text-slate-600" />}
                    </Button>
                  </div>
                  <TabsList className="bg-slate-100 p-0.5">
                    <TabsTrigger value="invoice" className="text-xs py-1 px-2.5">ใบวางบิล/Invoice</TabsTrigger>
                    <TabsTrigger value="po" className="text-xs py-1 px-2.5">ใบสั่งซื้อ (PO)</TabsTrigger>
                    <TabsTrigger value="gr" className="text-xs py-1 px-2.5">ใบส่ง/รับสินค้า (GR)</TabsTrigger>
                    <TabsTrigger value="others" className="text-xs py-1 px-2.5 font-medium">เอกสารอื่น ๆ</TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab Content: Invoice */}
                <TabsContent value="invoice" className="flex-1 mt-3 flex flex-col">
                  {payment.requestType === 'AR' ? (
                    // AR Dynamic template
                    <div className="flex-1 flex flex-col space-y-3">
                      <div className="flex justify-between items-center bg-slate-50 p-2 rounded flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600">ประเภทเอกสาร:</span>
                          <div className="flex bg-slate-200 p-0.5 rounded-lg border">
                            <button
                              className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${selectedArDoc === 'invoice' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                              onClick={() => setSelectedArDoc('invoice')}
                            >
                              ใบวางบิล / ใบแจ้งหนี้
                            </button>
                            <button
                              className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${selectedArDoc === 'delivery-tax' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                              onClick={() => setSelectedArDoc('delivery-tax')}
                            >
                              ใบส่งของ / ใบกำกับภาษี
                            </button>
                            <button
                              className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${selectedArDoc === 'receipt' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                              onClick={() => setSelectedArDoc('receipt')}
                            >
                              ใบเสร็จรับเงิน
                            </button>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-xs font-semibold" 
                          onClick={() => {
                            const path = selectedArDoc === 'invoice' ? 'insurance-invoice' : selectedArDoc === 'delivery-tax' ? 'insurance-delivery-tax' : 'insurance-receipt';
                            window.open(`/claims/${payment.claimId}/pdf/${path}`, '_blank');
                          }}
                        >
                          <Printer className="w-3.5 h-3.5 mr-1" /> พิมพ์ขนาดจริง
                        </Button>
                      </div>
                      <div className="w-full border rounded-lg bg-slate-100 overflow-auto min-h-[650px] relative">
                        <iframe 
                          src={`/claims/${payment.claimId}/pdf/${
                            selectedArDoc === 'invoice' ? 'insurance-invoice' : selectedArDoc === 'delivery-tax' ? 'insurance-delivery-tax' : 'insurance-receipt'
                          }?embed=true`}
                          className="border-none bg-slate-100"
                          style={{
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: 'top left',
                            width: `${100 / zoomLevel}%`,
                            height: `${650 / zoomLevel}px`
                          }}
                        />
                      </div>
                    </div>
                  ) : uploadInvoiceUrl ? (
                    // AP Scanned upload preview
                    <div className="flex-1 flex flex-col space-y-3">
                      <div className="flex justify-between items-center bg-slate-50 p-2 rounded">
                        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-teal-600" />
                          เอกสารบิล/Invoice ที่อัพโหลดโดยพนักงาน
                        </span>
                        <Button variant="outline" size="sm" className="h-7 text-xs font-semibold" onClick={() => window.open(uploadInvoiceUrl, '_blank')}>
                          <ExternalLink className="w-3.5 h-3.5 mr-1" /> เปิดหน้าใหม่
                        </Button>
                      </div>
                      <div className="flex-1 border rounded-lg bg-slate-100 overflow-hidden min-h-[600px] flex items-center justify-center relative">
                        {isPdfFile(uploadInvoiceUrl) ? (
                          <iframe 
                            src={uploadInvoiceUrl}
                            className="w-full h-[650px]"
                          />
                        ) : (
                          <div className="max-h-[650px] overflow-y-auto p-4 flex items-center justify-center w-full">
                            <img 
                              src={uploadInvoiceUrl} 
                              alt="Uploaded Invoice Preview" 
                              className="max-w-full h-auto max-h-[600px] border shadow rounded bg-white object-contain"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Fallback to table item list if no invoice URL
                    <div className="flex-1 flex flex-col space-y-4 pt-2">
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-800">ไม่มีไฟล์เอกสารแนบ</p>
                          <p className="text-[10px] text-amber-600 mt-0.5">พนักงานไม่ได้อัพโหลดรูปภาพหรือไฟล์ PDF ของบิลเข้ามาในระบบ แต่ได้ทำรายการผูกกับรายการอะไหล่และค่าแรงดังนี้:</p>
                        </div>
                      </div>
                      
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="text-xs">รายการสินค้า / ค่าบริการ</TableHead>
                              <TableHead className="text-xs text-right w-20">จำนวน</TableHead>
                              <TableHead className="text-xs text-right w-28">ราคาต่อหน่วย</TableHead>
                              <TableHead className="text-xs text-right w-28">ส่วนลด</TableHead>
                              <TableHead className="text-xs text-right w-28">ราคารวม</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="text-xs">
                            {((supplierInvoice?.items || garageInvoice?.items || []) as any[]).map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">
                                  {item.description}
                                  {item.partNo && <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{item.partNo}</span>}
                                </TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell className="text-right">฿{formatCurrency(item.unitPrice)}</TableCell>
                                <TableCell className="text-right">{item.discountPct > 0 ? `${item.discountPct}%` : '-'}</TableCell>
                                <TableCell className="text-right font-semibold">฿{formatCurrency(item.totalPrice)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-slate-50/50 font-semibold border-t">
                              <TableCell colSpan={4} className="text-right">รวมสุทธิ</TableCell>
                              <TableCell className="text-right text-teal-700">฿{formatCurrency(supplierInvoice?.subtotal || garageInvoice?.subtotal || payment.amount)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Tab Content: PO (Purchase Order) */}
                <TabsContent value="po" className="flex-1 mt-3 flex flex-col">
                  {claim?.purchaseOrders && claim.purchaseOrders.length > 0 ? (
                    <div className="flex-1 flex flex-col space-y-3">
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600">เลือกใบสั่งซื้อ (PO):</span>
                          <select 
                            className="text-xs border rounded p-1 font-mono font-medium bg-white" 
                            value={selectedPoId} 
                            onChange={e => setSelectedPoId(e.target.value)}
                          >
                            {claim.purchaseOrders.map((po: any) => (
                              <option key={po.id} value={po.id}>{po.poNo} - (฿{formatCurrency(po.totalAmount)})</option>
                            ))}
                          </select>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-xs font-semibold" onClick={() => window.open(`/claims/${payment.claimId}/pdf/purchase-order?poId=${selectedPoId}`, '_blank')}>
                          <Printer className="w-3.5 h-3.5 mr-1" /> พิมพ์ขนาดจริง
                        </Button>
                      </div>
                      
                      {selectedPoId ? (
                        <div className="w-full border rounded-lg bg-slate-100 overflow-auto min-h-[650px] relative">
                          <iframe 
                            src={`/claims/${payment.claimId}/pdf/purchase-order?poId=${selectedPoId}&embed=true`}
                            className="border-none bg-slate-100"
                            style={{
                              transform: `scale(${zoomLevel})`,
                              transformOrigin: 'top left',
                              width: `${100 / zoomLevel}%`,
                              height: `${650 / zoomLevel}px`
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex-1 border rounded-lg bg-slate-50 flex items-center justify-center p-8 text-center text-xs text-slate-400">
                          กรุณาเลือกใบสั่งซื้อที่ต้องการแสดงข้อมูล
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-12 text-center space-y-2">
                      <FileText className="w-10 h-10 text-slate-300" />
                      <p className="text-xs font-bold text-slate-600">ไม่พบใบสั่งซื้อ (PO)</p>
                      <p className="text-[10px] text-slate-400 max-w-xs">ไม่มีใบสั่งซื้อที่ออกให้ผู้จัดจำหน่ายรายนี้ในระบบของใบเคลมนี้</p>
                    </div>
                  )}
                </TabsContent>

                {/* Tab Content: Delivery Note / GR */}
                <TabsContent value="gr" className="flex-1 mt-3 flex flex-col">
                  {activePo?.goodsReceipts && activePo.goodsReceipts.length > 0 ? (
                    <div className="flex-1 flex flex-col space-y-3">
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-600">เลือกใบรับของ (GR):</span>
                          <select 
                            className="text-xs border rounded p-1 font-mono font-medium bg-white" 
                            value={selectedGrId} 
                            onChange={e => setSelectedGrId(e.target.value)}
                          >
                            {activePo.goodsReceipts.map((gr: any) => (
                              <option key={gr.id} value={gr.id}>รับเมื่อ: {formatDate(gr.receivedAt)}</option>
                            ))}
                          </select>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-xs font-semibold" onClick={() => window.open(`/claims/${payment.claimId}/pdf/delivery-note?poId=${selectedPoId}&grId=${selectedGrId}`, '_blank')}>
                          <Printer className="w-3.5 h-3.5 mr-1" /> พิมพ์ใบส่งของขนาดจริง
                        </Button>
                      </div>
                      
                      {selectedGrId ? (
                        <div className="w-full border rounded-lg bg-slate-100 overflow-auto min-h-[650px] relative">
                          <iframe 
                            src={`/claims/${payment.claimId}/pdf/delivery-note?poId=${selectedPoId}&grId=${selectedGrId}&embed=true`}
                            className="border-none bg-slate-100"
                            style={{
                              transform: `scale(${zoomLevel})`,
                              transformOrigin: 'top left',
                              width: `${100 / zoomLevel}%`,
                              height: `${650 / zoomLevel}px`
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex-1 border rounded-lg bg-slate-50 flex items-center justify-center p-8 text-center text-xs text-slate-400">
                          กรุณาเลือกใบส่งของที่ต้องการแสดงข้อมูล
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-12 text-center space-y-2">
                      <Printer className="w-10 h-10 text-slate-300" />
                      <p className="text-xs font-bold text-slate-600">ไม่พบเอกสารใบส่งสินค้า/ใบรับของ (GR)</p>
                      <p className="text-[10px] text-slate-400 max-w-xs">ยังไม่มีการบันทึกการรับของสินค้า (Goods Receipt) สำหรับใบสั่งซื้อนี้ในระบบ</p>
                    </div>
                  )}
                </TabsContent>

                {/* Tab Content: Other Attachments */}
                <TabsContent value="others" className="flex-1 mt-3 flex flex-col">
                  {claim?.documents && claim.documents.length > 0 ? (
                    <div className="flex-grow grid grid-cols-1 md:grid-cols-4 gap-4 h-full min-h-[550px]">
                      {/* Documents Directory */}
                      <div className="md:col-span-1 border rounded-lg overflow-y-auto max-h-[600px] p-2 space-y-1 bg-slate-50/50">
                        <p className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">ไฟล์แนบในใบเคลม</p>
                        {claim.documents.map((doc: any) => (
                          <button
                            key={doc.id}
                            onClick={() => setSelectedDocUrl(doc.fileUrl)}
                            className={`w-full text-left p-2 rounded-lg text-xs font-medium transition-colors flex items-start gap-1.5 break-all ${selectedDocUrl === doc.fileUrl ? 'bg-teal-50 text-teal-700 border-l-2 border-teal-600' : 'hover:bg-slate-100 text-slate-600'}`}
                          >
                            {isPdfFile(doc.fileUrl) ? <FileText className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" /> : <ImageIcon className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />}
                            <span className="leading-snug">{doc.fileName}</span>
                          </button>
                        ))}
                      </div>

                      {/* Document Preview Pane */}
                      <div className="md:col-span-3 border rounded-lg bg-slate-100 flex flex-col overflow-hidden min-h-[550px] relative">
                        {selectedDocUrl ? (
                          <>
                            <div className="bg-white border-b px-3 py-1.5 flex items-center justify-between text-xs font-medium text-slate-500">
                              <span className="truncate max-w-[250px]">พรีวิวไฟล์: {selectedDocUrl.split('/').pop()}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600" onClick={() => window.open(selectedDocUrl, '_blank')}>
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="flex-grow flex items-center justify-center p-2 relative h-full">
                              {isPdfFile(selectedDocUrl) ? (
                                <iframe 
                                  src={selectedDocUrl}
                                  className="w-full h-[550px]"
                                />
                              ) : (
                                <div className="max-h-[550px] overflow-y-auto p-2 flex items-center justify-center w-full">
                                  <img 
                                    src={selectedDocUrl} 
                                    alt="Claim Document Attachment Preview" 
                                    className="max-w-full h-auto max-h-[500px] border shadow rounded bg-white object-contain"
                                  />
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="flex-grow flex items-center justify-center p-8 text-center text-xs text-slate-400">
                            กรุณาเลือกไฟล์เอกสารแนบจากรายการด้านซ้ายเพื่อดูตัวอย่าง
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-12 text-center space-y-2">
                      <ImageIcon className="w-10 h-10 text-slate-300" />
                      <p className="text-xs font-bold text-slate-600">ไม่มีไฟล์เอกสารอื่น ๆ แนบในใบเคลม</p>
                      <p className="text-[10px] text-slate-400 max-w-xs">สามารถเพิ่มหรืออัพโหลดไฟล์แนบรูปภาพ รถยนต์ อะไหล่ หรือบิลเพิ่มได้ที่เมนูใบเคลม</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
