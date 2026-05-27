"use client"

import React, { useState } from 'react'
import { ArrowLeft, Upload, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface AIUploadViewProps {
  onBack: () => void
  onExtract: (file: File) => void
  showToast: (msg: string) => void
}

export default function AIUploadView({
  onBack,
  onExtract,
  showToast
}: AIUploadViewProps) {
  const [dragOver, setDragOver] = useState(false)

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onExtract(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onExtract(file)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in relative">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">AI อ่านเอกสาร</h1>
          <p className="text-sm text-[#94a3b8] mt-1">อัพโหลดเอกสาร Claim เพื่อให้ AI ช่วยกรอกข้อมูล</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-8">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer",
              dragOver ? "border-[#0d9488] bg-[#eff6ff] scale-[1.01]" : "border-gray-300 hover:border-[#0d9488] hover:bg-[#f8faff]"
            )}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#0d9488] to-[#2dd4bf] flex items-center justify-center mb-4 shadow-lg">
              <Upload className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-[#0f172a] mb-2">ลากไฟล์มาวางที่นี่</h3>
            <p className="text-sm text-[#94a3b8] mb-4">หรือคลิกเพื่อเลือกไฟล์</p>
            <p className="text-xs text-[#94a3b8]">รองรับ JPG, PNG, WEBP, HEIC, PDF — ขนาดสูงสุด 20MB</p>
            <input id="file-upload" type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" className="hidden" onChange={onFileChange} />
          </div>

          <div className="mt-6 flex items-center gap-3 text-sm text-[#475569]">
            <Sparkles className="w-5 h-5 text-[#0d9488]" />
            <span>AI จะอ่านเอกสารและกรอกข้อมูลให้อัตโนมัติ — คุณสามารถแก้ไขทุก field ได้ภายหลัง</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
