"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileSpreadsheet, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ExcelImportViewProps {
  onBack: () => void
  importing: boolean
  setImporting: (v: boolean) => void
  importResult: {
    success: boolean
    totalRows: number
    imported: number
    skipped: number
    errors: number
  } | null
  setImportResult: (res: any) => void
  showToast: (msg: string) => void
}

export default function ExcelImportView({
  onBack,
  importing,
  setImporting,
  importResult,
  setImportResult,
  showToast
}: ExcelImportViewProps) {
  const [dragOver, setDragOver] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await handleUploadExcel(file)
  }

  const handleDropExcel = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    await handleUploadExcel(file)
  }

  const handleUploadExcel = async (file: File) => {
    setImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/claims/import', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to import Excel file')
      }

      const result = await res.json()
      setImportResult(result)
      showToast('✅ นำเข้าข้อมูลจาก Excel สำเร็จ')
    } catch (err: any) {
      console.error(err)
      showToast('❌ ' + (err.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in relative">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} disabled={importing}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">นำเข้าจาก Excel</h1>
          <p className="text-sm text-[#94a3b8] mt-1">อัพโหลดไฟล์ Excel รายการอนุมัติเคลมเพื่อนำเข้าข้อมูลในระบบ</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-8">
          {!importResult && !importing && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDropExcel}
              className={cn(
                "border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer",
                dragOver ? "border-[#0d9488] bg-[#eff6ff] scale-[1.01]" : "border-gray-300 hover:border-[#0d9488] hover:bg-[#f8faff]"
              )}
              onClick={() => document.getElementById('excel-upload')?.click()}
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-green-600 to-emerald-500 flex items-center justify-center mb-4 shadow-lg">
                <FileSpreadsheet className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-[#0f172a] mb-2">ลากไฟล์ Excel มาวางที่นี่</h3>
              <p className="text-sm text-[#94a3b8] mb-4">หรือคลิกเพื่อเลือกไฟล์ (.xls, .xlsx)</p>
              <p className="text-xs text-[#94a3b8]">รองรับรูปแบบข้อมูลตามไฟล์ template_approve.xls</p>
              <input id="excel-upload" type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFileSelect} />
            </div>
          )}

          {importing && (
            <div className="text-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto" />
              <h3 className="text-lg font-semibold text-[#0f172a]">กำลังนำเข้าข้อมูลจาก Excel...</h3>
              <p className="text-sm text-gray-500">ระบบกำลังประมวลผลข้อมูลและจับคู่บริษัทประกันกับศูนย์บริการ</p>
            </div>
          )}

          {importResult && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm">การนำเข้าข้อมูลเสร็จสิ้น</h4>
                  <p className="text-xs text-green-700 mt-0.5">ระบบได้ประมวลผลข้อมูลในไฟล์ทั้งหมดเรียบร้อยแล้ว</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[#f8faff] rounded-xl p-4 border text-center">
                  <span className="text-xs text-[#475569]">แถวทั้งหมดในไฟล์</span>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{importResult.totalRows} แถว</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border border-green-100 text-center">
                  <span className="text-xs text-green-700">นำเข้าสำเร็จ</span>
                  <p className="text-2xl font-bold text-green-600 mt-1">{importResult.imported} รายการ</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-center">
                  <span className="text-xs text-amber-700">ข้าม (มีในระบบแล้ว)</span>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{importResult.skipped} รายการ</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4 border border-red-100 text-center">
                  <span className="text-xs text-red-700">พบข้อผิดพลาด</span>
                  <p className="text-2xl font-bold text-red-600 mt-1">{importResult.errors} รายการ</p>
                </div>
              </div>

              <div className="flex gap-3 justify-end border-t pt-4">
                <Button variant="outline" onClick={() => setImportResult(null)}>นำเข้าไฟล์อื่น</Button>
                <Link href="/claims">
                  <Button className="bg-[#0d9488] hover:bg-[#0d9488]/90 text-white">ไปที่รายการ Claim ทั้งหมด</Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
