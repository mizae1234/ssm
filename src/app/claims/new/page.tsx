"use client"

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Sparkles, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

// Dynamically import the heavy sub-views
const ExcelImportView = dynamic(() => import('./components/ExcelImportView'), {
  ssr: false,
  loading: () => <div className="max-w-3xl mx-auto p-12 text-center text-gray-500 animate-pulse">กำลังโหลดระบบนำเข้า Excel...</div>
})

const AIUploadView = dynamic(() => import('./components/AIUploadView'), {
  ssr: false,
  loading: () => <div className="max-w-3xl mx-auto p-12 text-center text-gray-500 animate-pulse">กำลังโหลดระบบอัพโหลด...</div>
})

const AIProcessingView = dynamic(() => import('./components/AIProcessingView'), {
  ssr: false
})

const ClaimReviewForm = dynamic(() => import('./components/ClaimReviewForm'), {
  ssr: false,
  loading: () => <div className="max-w-5xl mx-auto p-12 text-center text-gray-500 animate-pulse">กำลังโหลดแบบฟอร์มข้อมูล...</div>
})

const emptyDataTemplate = {
  claim: {
    claimNo: { value: '', confidence: 0 },
    ePartNo: { value: '', confidence: 0 },
    receiveNo: { value: '', confidence: 0 },
    transactionNo: { value: '', confidence: 0 },
    insuranceName: { value: '', confidence: 0 },
    branch: { value: '', confidence: 0 },
    status: { value: '', confidence: 0 },
    createdAt: { value: '', confidence: 0 },
    sentAt: { value: '', confidence: 0 },
  },
  car: {
    plate: { value: '', confidence: 0 },
    province: { value: '', confidence: 0 },
    brand: { value: '', confidence: 0 },
    model: { value: '', confidence: 0 },
    vin: { value: '', confidence: 0 },
    color: { value: '', confidence: 0 },
    insuredName: { value: '', confidence: 0 },
  },
  labors: [],
  parts: [],
  summary: {
    laborTotal: { value: 0, confidence: 0 },
    partsTotal: { value: 0, confidence: 0 },
    subtotal: { value: 0, confidence: 0 },
    vat: { value: 0, confidence: 0 },
    grandTotal: { value: 0, confidence: 0 },
    deductible: { value: 0, confidence: 0 },
  },
  validation: { passed: true, warnings: [] }
}

export default function NewClaimPage() {
  const router = useRouter()
  const [step, setStep] = useState<'choose' | 'upload' | 'processing' | 'form' | 'import'>('choose')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    totalRows: number
    imported: number
    skipped: number
    errors: number
  } | null>(null)
  const [processingStep, setProcessingStep] = useState(0)
  const [data, setData] = useState<any>(null)
  const [isManualMode, setIsManualMode] = useState(false)
  const [partsMaster, setPartsMaster] = useState<any[]>([])
  const [insurances, setInsurances] = useState<any[]>([])
  const [toast, setToast] = useState<string | null>(null)
  
  const showToast = useCallback((msg: string) => { 
    setToast(msg)
    setTimeout(() => setToast(null), 3500) 
  }, [])

  useEffect(() => {
    fetch('/api/parts-master?all=true')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setPartsMaster(data)
      })
      .catch(console.error)

    fetch('/api/insurances?simple=true')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setInsurances(data)
      })
      .catch(console.error)
  }, [])

  const startManual = () => {
    setData(JSON.parse(JSON.stringify(emptyDataTemplate)))
    setIsManualMode(true)
    setStep('form')
  }

  // Compress image before sending to API (Width constraint only)
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type === 'application/pdf') {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
        return
      }

      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        const MAX_WIDTH = 2048
        let { width, height } = img
        if (width > MAX_WIDTH) {
          height = Math.round(height * MAX_WIDTH / width)
          width = MAX_WIDTH
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        const compressed = canvas.toDataURL('image/jpeg', 0.88)
        console.log(`[compress] ${file.name}: ${(file.size/1024/1024).toFixed(2)}MB → ~${(compressed.length*0.75/1024/1024).toFixed(2)}MB, ${width}x${height}px`)
        resolve(compressed)
      }
      img.onerror = reject
      img.src = objectUrl
    })
  }

  const handleExtract = useCallback(async (files: File[]) => {
    setStep('processing')
    setProcessingStep(0)
    setIsManualMode(false)
    const progressInterval = setInterval(() => {
      setProcessingStep(prev => prev < 3 ? prev + 1 : prev)
    }, 2000)

    try {
      // Compress all files
      const compressedFiles = await Promise.all(
        files.map(async (file) => {
          const base64data = await compressImage(file)
          const mimeType = file.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg'
          return { file: base64data, mimeType }
        })
      )

      const res = await fetch('/api/ai/extract-claim', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: compressedFiles }) 
      })

      const result = await res.json()
      clearInterval(progressInterval)

      if (!res.ok || result.error) {
        const errMsg = result.error || `HTTP ${res.status}`
        console.error('[AI extract] error:', errMsg)
        showToast('❌ AI อ่านไม่สำเร็จ: ' + errMsg)
        setStep('upload')
        return
      }

      setProcessingStep(4)
      setTimeout(() => {
        setData(result)
        setStep('form')
      }, 500)
    } catch (err: any) {
      clearInterval(progressInterval)
      console.error('Extract error:', err)
      showToast('❌ เกิดข้อผิดพลาด: ' + (err?.message || 'ไม่สามารถเชื่อมต่อ AI ได้'))
      setStep('upload')
    }
  }, [showToast])

  const handleSave = async () => {
    if (!data?.claim?.ePartNo?.value?.trim()) {
      showToast('❌ กรุณาระบุหมายเลข E-Part')
      return
    }
    if (data?.parts && Array.isArray(data.parts)) {
      const emptyPartIndex = data.parts.findIndex((p: any) => !p.partName?.value?.trim())
      if (emptyPartIndex !== -1) {
        showToast(`❌ กรุณาระบุชื่ออะไหล่ให้ครบทุกรายการ (รายการที่ ${emptyPartIndex + 1})`)
        return
      }
    }
    if (data?.labors && Array.isArray(data.labors)) {
      const emptyLaborIndex = data.labors.findIndex((l: any) => !l.description?.value?.trim())
      if (emptyLaborIndex !== -1) {
        showToast(`❌ กรุณาระบุชื่อรายการค่าแรงให้ครบทุกรายการ (รายการที่ ${emptyLaborIndex + 1})`)
        return
      }
    }

    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save')
      }
      router.push('/claims')
    } catch (err: any) {
      showToast('❌ เกิดข้อผิดพลาดในการบันทึก: ' + err.message)
    }
  }

  return (
    <div className="min-h-[500px]">
      {toast && (
        <div className={`fixed top-6 right-6 text-white px-6 py-3 rounded-xl shadow-2xl z-50 animate-in slide-in-from-top-4 font-medium flex items-center gap-2 ${toast.includes('❌') || toast.includes('⚠️') ? 'bg-red-600' : 'bg-gray-800'}`}>
          {!toast.includes('❌') && !toast.includes('⚠️') && !toast.includes('✅') && '✅ '}
          <span>{toast}</span>
        </div>
      )}

      {step === 'choose' && (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in relative">
          <div className="flex items-center gap-3">
            <Link href="/claims">
              <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-[#0f172a]">รับ Claim ใหม่</h1>
              <p className="text-sm text-[#94a3b8] mt-1">เลือกวิธีการบันทึกข้อมูล Claim</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="cursor-pointer hover:shadow-lg hover:border-[#0d9488] transition-all duration-300 group" onClick={() => setStep('upload')}>
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#0d9488] to-[#2dd4bf] flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-[#0f172a] mb-2">AI อ่านเอกสาร</h3>
                <p className="text-sm text-[#475569] mb-4">อัพโหลดภาพหรือ PDF เอกสาร Claim<br/>AI จะช่วยกรอกข้อมูลให้อัตโนมัติ</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {['JPG', 'PNG', 'PDF', 'HEIC'].map(f => (
                    <span key={f} className="px-2 py-0.5 rounded bg-[#eff6ff] text-[#0d9488] text-[10px] font-medium">{f}</span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg hover:border-[#0d9488] transition-all duration-300 group" onClick={startManual}>
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#475569] to-[#64748b] flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <FileText className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-[#0f172a] mb-2">กรอกข้อมูลเอง</h3>
                <p className="text-sm text-[#475569] mb-4">กรอกข้อมูล Claim, รถยนต์,<br/>อะไหล่ และค่าแรงด้วยตัวเอง</p>
                <span className="px-3 py-1 rounded-full bg-gray-100 text-[#475569] text-xs font-medium">ป้อนข้อมูลเอง</span>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === 'import' && (
        <ExcelImportView
          onBack={() => setStep('choose')}
          importing={importing}
          setImporting={setImporting}
          importResult={importResult}
          setImportResult={setImportResult}
          showToast={showToast}
        />
      )}

      {step === 'upload' && (
        <AIUploadView
          onBack={() => setStep('choose')}
          onExtract={handleExtract}
          showToast={showToast}
        />
      )}

      {step === 'processing' && (
        <AIProcessingView processingStep={processingStep} />
      )}

      {step === 'form' && (
        <ClaimReviewForm
          data={data}
          setData={setData}
          isManualMode={isManualMode}
          partsMaster={partsMaster}
          insurances={insurances}
          onBack={() => setStep('choose')}
          onSave={handleSave}
          onReupload={isManualMode ? undefined : () => setStep('upload')}
        />
      )}
    </div>
  )
}
