"use client"

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, Edit, Package, History, AlertTriangle, 
  TrendingUp, TrendingDown, Truck, Calendar, DollarSign, 
  CheckCircle, Plus, Eye
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { SkeletonTableRows } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export default function PartMasterDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [part, setPart] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit modal states
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedPart, setSelectedPart] = useState<any>(null)

  useEffect(() => {
    if (id) {
      fetchPartDetails()
    }
  }, [id])

  const fetchPartDetails = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/parts-master/${id}`)
      if (!res.ok) {
        throw new Error('ไม่สามารถดึงข้อมูลอะไหล่ได้')
      }
      const data = await res.json()
      setPart(data)
      setSelectedPart({
        ...data,
        standardPrice: data.standardPrice ?? '',
        purchasePrice: data.purchasePrice ?? '',
        stock: data.stock ?? 0,
      })
      setError(null)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!selectedPart.partNo || !selectedPart.partName) {
      alert('กรุณากรอกรหัสอะไหล่และชื่ออะไหล่')
      return
    }

    try {
      setIsSaving(true)
      const res = await fetch(`/api/parts-master/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedPart,
          standardPrice: selectedPart.standardPrice === '' ? null : Number(selectedPart.standardPrice),
          purchasePrice: selectedPart.purchasePrice === '' ? null : Number(selectedPart.purchasePrice),
          stock: Number(selectedPart.stock) || 0,
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'บันทึกไม่สำเร็จ')
      }

      setIsEditOpen(false)
      fetchPartDetails()
    } catch (err: any) {
      console.error(err)
      alert(`❌ เกิดข้อผิดพลาด: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[400px] bg-gray-100 animate-pulse rounded-xl" />
          <div className="h-[400px] bg-gray-100 animate-pulse rounded-xl" />
        </div>
        <div className="h-[300px] bg-gray-100 animate-pulse rounded-xl" />
      </div>
    )
  }

  if (error || !part) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center space-y-4">
        <AlertTriangle className="w-16 h-16 mx-auto text-amber-500" />
        <h2 className="text-xl font-bold text-slate-800">เกิดข้อผิดพลาด</h2>
        <p className="text-slate-600">{error || 'ไม่พบข้อมูลอะไหล่ในระบบ'}</p>
        <Button onClick={() => router.push('/parts-master')} className="bg-[#0d9488] text-white">
          กลับสู่หน้ารายการอะไหล่
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/parts-master">
            <Button variant="outline" size="icon" className="h-9 w-9 border-slate-200 hover:bg-slate-50 transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-600" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <span>{part.partName}</span>
              <span className="font-mono text-sm font-normal text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                {part.partNo}
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">รายละเอียดข้อมูลสินค้า ประวัติสต็อก และราคาจากคู่ค้า</p>
          </div>
        </div>

        <Button 
          className="bg-[#0d9488] hover:bg-[#0f766e] text-white flex items-center gap-2 shadow-sm rounded-lg"
          onClick={() => setIsEditOpen(true)}
        >
          <Edit className="w-4 h-4" />
          แก้ไขข้อมูลอะไหล่
        </Button>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: General Part Master Details */}
        <Card className="lg:col-span-2 shadow-sm border border-slate-200/80 rounded-xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#0d9488]" />
              ข้อมูลอะไหล่ทั่วไป
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-6">
              
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">รหัสอะไหล่ (Part No.)</span>
                <p className="font-mono font-bold text-slate-800">{part.partNo}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">ชื่ออะไหล่ (Part Name)</span>
                <p className="font-semibold text-slate-800">{part.partName}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">หมวดหมู่ (Category)</span>
                <p className="text-slate-700">{part.category || '-'}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">หน่วยนับ (Unit)</span>
                <p className="text-slate-700">{part.unit || 'ชิ้น'}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">ราคากลาง (Standard Price)</span>
                <p className="font-mono font-bold text-emerald-600">
                  {part.standardPrice ? formatCurrency(part.standardPrice) : 'ยังไม่ได้กำหนด'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">ราคาซื้อ (Purchase Price)</span>
                <p className="font-mono font-bold text-slate-800">
                  {part.purchasePrice ? formatCurrency(part.purchasePrice) : 'ยังไม่ได้กำหนด'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">PEAK Product Code</span>
                <div className="flex items-center gap-2 mt-0.5">
                  {part.peakCode ? (
                    <>
                      <span className="font-mono text-sm text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{part.peakCode}</span>
                      <span className="text-sm" title="เชื่อมโยงเรียบร้อย">✅</span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 italic">ไม่ได้กำหนด</span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">จำนวนสต็อกคงเหลือ (Stock)</span>
                <div className="mt-0.5">
                  <Badge variant="outline" className={cn("font-mono text-sm px-2.5 py-0.5", (part.stock || 0) > 0 ? "text-emerald-600 border-emerald-200 bg-emerald-50/50" : "text-slate-400 border-slate-200")}>
                    {part.stock ?? 0} {part.unit || 'ชิ้น'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">แหล่งที่มา (Source)</span>
                <div className="mt-0.5">
                  {part.source === 'AUTO' ? (
                    <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-none shadow-none text-xs px-2.5">สร้างอัตโนมัติ (AUTO)</Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-none shadow-none text-xs px-2.5">คีย์มือ (MANUAL)</Badge>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">สถานะการใช้งาน</span>
                <div className="mt-0.5">
                  {part.isActive ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-none shadow-none text-xs px-2.5">ใช้งานปกติ</Badge>
                  ) : (
                    <Badge className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-none shadow-none text-xs px-2.5">ปิดใช้งาน</Badge>
                  )}
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">รายละเอียดเพิ่มเติม</span>
                <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed mt-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {part.description || 'ไม่มีคำอธิบายเพิ่มเติม'}
                </p>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Right Side: Vendor Prices List */}
        <Card className="shadow-sm border border-slate-200/80 rounded-xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#0d9488]" />
              ราคาซื้อจากคู่ค้า (Vendors)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-500 text-xs">
                    <th className="text-left p-3 font-semibold">ชื่อร้านค้า / แบรนด์</th>
                    <th className="text-right p-3 font-semibold">ราคาต่อหน่วย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {part.vendorPrices?.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-6 text-center text-xs text-slate-400 italic">ยังไม่มีข้อมูลราคาร้านค้า</td>
                    </tr>
                  ) : (
                    part.vendorPrices?.map((vp: any) => (
                      <tr key={vp.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3">
                          <div className="font-medium text-slate-800">{vp.vendor?.name || 'ไม่ทราบร้านค้า'}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="bg-slate-100 px-1 py-0.2 rounded font-normal text-slate-500 border border-slate-200">
                              {vp.brand}
                            </span>
                            {vp.isPreferred && (
                              <span className="text-emerald-600 font-medium">★ ร้านประจำ</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-mono font-bold text-slate-800">{formatCurrency(vp.price)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section: Stock Movement History (Logs) */}
      <Card className="shadow-sm border border-slate-200/80 rounded-xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <History className="w-4 h-4 text-[#0d9488]" />
            ประวัติความเคลื่อนไหวสต็อกสินค้า (Stock Movement Log)
          </CardTitle>
          <Badge className="bg-[#f8faff] border border-slate-200 text-slate-700 shadow-none">
            ทั้งหมด {part.movements?.length || 0} รายการ
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-500 text-xs">
                  <th className="text-left p-4 font-semibold">วัน-เวลาทำรายการ</th>
                  <th className="text-center p-4 font-semibold">ประเภท</th>
                  <th className="text-right p-4 font-semibold">จำนวนทำรายการ</th>
                  <th className="text-left p-4 font-semibold">เอกสารอ้างอิง / คูค้า</th>
                  <th className="text-left p-4 font-semibold">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {part.movements?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400 italic">
                      ยังไม่มีรายการบันทึกประวัติยอดความเคลื่อนไหวสต็อกของอะไหล่นี้
                    </td>
                  </tr>
                ) : (
                  part.movements?.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-50/30 transition-colors">
                      {/* Date & Time */}
                      <td className="p-4 text-slate-600 font-mono text-xs">
                        {new Date(m.createdAt).toLocaleString('th-TH')}
                      </td>
                      
                      {/* Type Badge */}
                      <td className="p-4 text-center">
                        {m.movementType === 'IN' ? (
                          <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-none shadow-none text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            รับเข้า (IN)
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 border-none shadow-none text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" />
                            จ่ายออก (OUT)
                          </Badge>
                        )}
                      </td>
                      
                      {/* Quantity */}
                      <td className="p-4 text-right font-mono font-bold">
                        <span className={m.movementType === 'IN' ? 'text-emerald-600' : 'text-rose-600'}>
                          {m.movementType === 'IN' ? `+${m.quantity}` : `-${m.quantity}`}
                        </span>
                      </td>

                      {/* Document References */}
                      <td className="p-4 text-slate-700">
                        <div className="space-y-0.5">
                          {m.claimNo && (
                            <Link href={`/claims/${m.claimId}`} className="text-[#0d9488] hover:underline font-medium inline-flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              ใบเคลม {m.claimNo}
                            </Link>
                          )}
                          {m.vendorName && (
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                              <Truck className="w-3 h-3 text-slate-400" />
                              คู่ค้า: {m.vendorName}
                            </div>
                          )}
                          {!m.claimNo && !m.vendorName && (
                            <span className="text-slate-400 italic text-xs">ไม่มีข้อมูลอ้างอิง</span>
                          )}
                        </div>
                      </td>

                      {/* Note */}
                      <td className="p-4 text-slate-600 text-xs">
                        {m.note || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal (Dialog) */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl bg-white border rounded-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">
              แก้ไขข้อมูลอะไหล่: {part.partNo}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              ปรับปรุงรายละเอียดราคากลาง, สต็อกคงคลัง และรหัสสินค้าสำหรับเชื่อมต่อกับบัญชี PEAK
            </DialogDescription>
          </DialogHeader>

          {selectedPart && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">รหัสอะไหล่ (Part No.) <span className="text-rose-500">*</span></label>
                <Input
                  placeholder="เช่น 12345-ABC"
                  value={selectedPart.partNo || ''}
                  onChange={e => setSelectedPart({ ...selectedPart, partNo: e.target.value })}
                  className="border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">ชื่ออะไหล่ (Part Name) <span className="text-rose-500">*</span></label>
                <Input
                  placeholder="เช่น กันชนหน้า"
                  value={selectedPart.partName || ''}
                  onChange={e => setSelectedPart({ ...selectedPart, partName: e.target.value })}
                  className="border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">หมวดหมู่ (Category)</label>
                <Input
                  placeholder="เช่น กันชน, ไฟ, ตัวถัง"
                  value={selectedPart.category || ''}
                  onChange={e => setSelectedPart({ ...selectedPart, category: e.target.value })}
                  className="border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">หน่วยนับ (Unit)</label>
                <Input
                  placeholder="ชิ้น, ชุด, ตัว"
                  value={selectedPart.unit || 'ชิ้น'}
                  onChange={e => setSelectedPart({ ...selectedPart, unit: e.target.value })}
                  className="border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">ราคากลาง (Standard Price)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={selectedPart.standardPrice ?? ''}
                  onChange={e => setSelectedPart({ ...selectedPart, standardPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">ราคาซื้อ (Purchase Price)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={selectedPart.purchasePrice ?? ''}
                  onChange={e => setSelectedPart({ ...selectedPart, purchasePrice: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">รหัสสินค้าใน PEAK (PEAK Product Code)</label>
                <Input
                  placeholder="เช่น P00001"
                  value={selectedPart.peakCode || ''}
                  onChange={e => setSelectedPart({ ...selectedPart, peakCode: e.target.value })}
                  className="border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">จำนวนสต็อกคงเหลือ (Stock)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={selectedPart.stock ?? 0}
                  onChange={e => setSelectedPart({ ...selectedPart, stock: Number(e.target.value) || 0 })}
                  className="border-slate-200"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-600">สถานะการใช้งาน</label>
                <select
                  className="w-full p-2 border rounded-md text-sm bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
                  value={String(selectedPart.isActive)}
                  onChange={e => setSelectedPart({ ...selectedPart, isActive: e.target.value === 'true' })}
                >
                  <option value="true">Active (ใช้งานปกติ)</option>
                  <option value="false">Inactive (ปิดใช้งาน)</option>
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-600">คำอธิบาย / รายละเอียดเพิ่มเติม</label>
                <textarea
                  className="w-full p-2 border rounded-md text-sm min-h-[85px] border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
                  placeholder="ข้อมูลเพิ่มเติม..."
                  value={selectedPart.description || ''}
                  onChange={e => setSelectedPart({ ...selectedPart, description: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="border-slate-200">ยกเลิก</Button>
            <Button className="bg-[#0d9488] hover:bg-[#0f766e] text-white" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
