"use client"

import React from 'react'
import { Sparkles, CheckCircle2, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const processingSteps = [
  'กำลังอ่านเอกสาร...',
  'วิเคราะห์ข้อมูล Claim...',
  'ระบุข้อมูลรถยนต์...',
  'อ่านรายการอะไหล่และค่าแรง...',
  'ตรวจสอบความถูกต้อง...',
]

interface AIProcessingViewProps {
  processingStep: number
}

export default function AIProcessingView({ processingStep }: AIProcessingViewProps) {
  return (
    <div className="max-w-lg mx-auto mt-24 animate-fade-in">
      <Card>
        <CardContent className="p-10 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#0d9488] to-[#2dd4bf] flex items-center justify-center mb-6 animate-pulse-soft shadow-xl">
            <Sparkles className="w-9 h-9 text-white" />
          </div>
          <h2 className="text-xl font-bold text-[#0f172a] mb-6">AI กำลังอ่านเอกสาร</h2>
          <div className="space-y-3 text-left">
            {processingSteps.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                {i < processingStep ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                ) : i === processingStep ? (
                  <Loader2 className="w-5 h-5 text-[#0d9488] animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex-shrink-0" />
                )}
                <span className={cn("text-sm", i <= processingStep ? "text-[#0f172a] font-medium" : "text-[#94a3b8]")}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
