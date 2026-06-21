"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Upload, Sparkles, X, Images, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface AIUploadViewProps {
  onBack: () => void
  onExtract: (files: File[]) => void
  showToast: (msg: string) => void
}

export default function AIUploadView({
  onBack,
  onExtract,
  showToast
}: AIUploadViewProps) {
  const [dragOver, setDragOver] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])

  // Generate preview URLs for selected files
  useEffect(() => {
    const urls = selectedFiles.map(file => {
      if (file.type === 'application/pdf') return ''
      return URL.createObjectURL(file)
    })
    setPreviews(urls)
    return () => urls.forEach(url => { if (url) URL.revokeObjectURL(url) })
  }, [selectedFiles])

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf']

  const isValidFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    return allowedTypes.includes(file.type) || allowedExts.includes(ext)
  }

  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles = newFiles.filter(isValidFile)
    if (validFiles.length === 0) {
      showToast('❌ ไฟล์ที่เลือกไม่รองรับ กรุณาใช้ JPG, PNG, WEBP, HEIC หรือ PDF')
      return
    }
    if (validFiles.length < newFiles.length) {
      showToast(`⚠️ มีบางไฟล์ไม่รองรับ เพิ่มได้ ${validFiles.length} จาก ${newFiles.length} ไฟล์`)
    }
    setSelectedFiles(prev => {
      const combined = [...prev, ...validFiles]
      if (combined.length > 10) {
        showToast('⚠️ สูงสุด 10 รูป')
        return combined.slice(0, 10)
      }
      return combined
    })
  }, [showToast])

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleStartExtract = () => {
    if (selectedFiles.length === 0) {
      showToast('❌ กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์')
      return
    }
    onExtract(selectedFiles)
  }

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        const fileArray = Array.from(files)
        const validFiles = fileArray.filter(isValidFile)
        if (validFiles.length > 0) {
          showToast(`📋 วางไฟล์จาก Clipboard ${validFiles.length} ไฟล์`)
          addFiles(validFiles)
          e.preventDefault()
          return
        }
      }

      const items = e.clipboardData?.items
      if (items) {
        const imageFiles: File[] = []
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile()
            if (file) {
              const renamedFile = new File([file], `clipboard-screenshot-${Date.now()}-${i}.png`, { type: file.type })
              imageFiles.push(renamedFile)
            }
          }
        }
        if (imageFiles.length > 0) {
          showToast(`📋 วางรูปภาพจาก Clipboard ${imageFiles.length} รูป`)
          addFiles(imageFiles)
          e.preventDefault()
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [addFiles, showToast])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      addFiles(Array.from(files))
    }
    // Reset input so the same file can be selected again
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      addFiles(Array.from(files))
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in relative">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">AI อ่านเอกสาร</h1>
          <p className="text-sm text-[#94a3b8] mt-1">อัพโหลดเอกสาร Claim เพื่อให้ AI ช่วยกรอกข้อมูล — รองรับหลายรูป</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-8">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer",
              dragOver ? "border-[#0d9488] bg-[#eff6ff] scale-[1.01]" : "border-gray-300 hover:border-[#0d9488] hover:bg-[#f8faff]"
            )}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#0d9488] to-[#2dd4bf] flex items-center justify-center mb-4 shadow-lg">
              {selectedFiles.length > 0 ? <Images className="w-7 h-7 text-white" /> : <Upload className="w-7 h-7 text-white" />}
            </div>
            <h3 className="text-lg font-semibold text-[#0f172a] mb-2">
              {selectedFiles.length > 0 ? 'เพิ่มรูปอีก' : 'ลากไฟล์มาวางที่นี่'}
            </h3>
            <p className="text-sm text-[#94a3b8] mb-2">หรือคลิกเพื่อเลือกไฟล์ (เลือกได้หลายไฟล์)</p>
            <p className="text-xs text-[#94a3b8]">รองรับ JPG, PNG, WEBP, HEIC, PDF — สูงสุด 10 รูป</p>
            <input 
              id="file-upload" 
              type="file" 
              accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" 
              className="hidden" 
              onChange={onFileChange}
              multiple
            />
          </div>

          {/* Preview grid */}
          {selectedFiles.length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#0f172a] flex items-center gap-2">
                  <Images className="w-4 h-4 text-[#0d9488]" />
                  เลือกแล้ว {selectedFiles.length} ไฟล์
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => setSelectedFiles([])}
                >
                  ลบทั้งหมด
                </Button>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shadow-sm hover:shadow-md transition-shadow">
                    {previews[i] ? (
                      <img
                        src={previews[i]}
                        alt={file.name}
                        className="w-full h-28 object-cover"
                      />
                    ) : (
                      <div className="w-full h-28 flex items-center justify-center bg-gray-100">
                        <span className="text-2xl font-bold text-gray-400">PDF</span>
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="px-2 py-1.5">
                      <p className="text-[10px] text-[#475569] truncate">{file.name}</p>
                      <p className="text-[10px] text-[#94a3b8]">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                ))}

                {/* Add more button */}
                {selectedFiles.length < 10 && (
                  <div
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="rounded-xl border-2 border-dashed border-gray-300 hover:border-[#0d9488] h-[156px] flex flex-col items-center justify-center cursor-pointer transition-colors group"
                  >
                    <Plus className="w-6 h-6 text-gray-400 group-hover:text-[#0d9488] transition-colors" />
                    <span className="text-xs text-gray-400 group-hover:text-[#0d9488] mt-1 transition-colors">เพิ่มรูป</span>
                  </div>
                )}
              </div>

              {/* Extract button */}
              <Button
                onClick={handleStartExtract}
                className="w-full h-12 text-base bg-gradient-to-r from-[#0d9488] to-[#2dd4bf] hover:from-[#0b847a] hover:to-[#22c5ab] shadow-lg"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                เริ่มอ่านเอกสาร ({selectedFiles.length} {selectedFiles.length > 1 ? 'รูป' : 'ไฟล์'})
              </Button>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3 text-sm text-[#475569]">
            <Sparkles className="w-5 h-5 text-[#0d9488] flex-shrink-0" />
            <span>อัพโหลดหลายรูปได้ เช่น screenshot หลายส่วนของเอกสารเดียวกัน — AI จะอ่านรวมกันและกรอกข้อมูลให้อัตโนมัติ</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
