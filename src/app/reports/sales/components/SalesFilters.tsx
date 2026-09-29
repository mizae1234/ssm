"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Calendar, Search, RotateCcw, Shield, X } from 'lucide-react'
import { AR_STATUS_OPTIONS } from '../constants'
import { SalesFilterValues } from '../types'

interface SalesFiltersProps {
  filters: SalesFilterValues
  insurances: any[]
  onChange: (key: keyof SalesFilterValues, value: string) => void
  onReset: () => void
}

function formatLocalInputDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function SalesFilters({
  filters,
  insurances,
  onChange,
  onReset,
}: SalesFiltersProps) {
  const currentYear = new Date().getFullYear()
  const currentBE = currentYear + 543

  const [insuranceInput, setInsuranceInput] = useState(filters.insuranceSearch || '')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInsuranceInput(filters.insuranceSearch || '')
  }, [filters.insuranceSearch])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter insurance suggestions
  const insuranceSuggestions = useMemo(() => {
    if (!insuranceInput.trim()) return insurances.slice(0, 8)
    const q = insuranceInput.toLowerCase().trim()
    return insurances
      .filter(ins =>
        ins.name?.toLowerCase().includes(q) ||
        ins.peakCustomerId?.toLowerCase().includes(q) ||
        ins.id?.toLowerCase().includes(q)
      )
      .slice(0, 10)
  }, [insurances, insuranceInput])

  // Quick preset ranges computed dynamically
  const presets = useMemo(() => {
    const now = new Date()
    return [
      {
        id: 'thisMonth',
        label: 'เดือนนี้',
        getFrom: () => formatLocalInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
        getTo: () => formatLocalInputDate(now),
      },
      {
        id: 'lastMonth',
        label: 'เดือนที่แล้ว',
        getFrom: () => formatLocalInputDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        getTo: () => formatLocalInputDate(new Date(now.getFullYear(), now.getMonth(), 0)),
      },
      {
        id: '3months',
        label: '3 เดือนย้อนหลัง',
        getFrom: () => formatLocalInputDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
        getTo: () => formatLocalInputDate(now),
      },
      {
        id: 'thisYear',
        label: `ปีนี้ (${currentBE})`,
        getFrom: () => formatLocalInputDate(new Date(now.getFullYear(), 0, 1)),
        getTo: () => formatLocalInputDate(now),
      },
      {
        id: 'all',
        label: 'ทั้งหมด',
        getFrom: () => `${currentYear - 2}-01-01`,
        getTo: () => formatLocalInputDate(now),
      },
    ]
  }, [currentYear, currentBE])

  const handleApplyPreset = (preset: typeof presets[0]) => {
    onChange('dateFrom', preset.getFrom())
    onChange('dateTo', preset.getTo())
  }

  const handleInsuranceInputChange = (val: string) => {
    setInsuranceInput(val)
    onChange('insuranceSearch', val)
    onChange('insuranceId', '')
    setShowSuggestions(true)
  }

  const handleSelectSuggestion = (ins: any) => {
    setInsuranceInput(ins.name)
    onChange('insuranceSearch', ins.name)
    onChange('insuranceId', ins.id)
    setShowSuggestions(false)
  }

  const handleClearInsurance = () => {
    setInsuranceInput('')
    onChange('insuranceSearch', '')
    onChange('insuranceId', '')
    setShowSuggestions(false)
  }

  const isFiltered = Boolean(
    filters.insuranceId ||
    filters.insuranceSearch ||
    filters.status !== 'ACTIVE' ||
    filters.search
  )

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-4 space-y-3">
        {/* Presets Row */}
        <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-gray-100">
          <span className="text-xs font-medium text-[#64748b] flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-[#0d9488]" />
            ช่วงเวลาเร็ว:
          </span>
          {presets.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleApplyPreset(p)}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 text-[#475569] hover:bg-teal-50 hover:text-[#0d9488] transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Filters Controls Row */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Date Range Inputs */}
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={e => onChange('dateFrom', e.target.value)}
              className="w-36 h-9 bg-white text-xs"
            />
            <span className="text-xs text-[#94a3b8]">ถึง</span>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={e => onChange('dateTo', e.target.value)}
              className="w-36 h-9 bg-white text-xs"
            />
          </div>

          <div className="w-px h-6 bg-gray-200 hidden sm:block" />

          {/* Freetext Insurance Search Input with Autocomplete */}
          <div className="relative w-64" ref={containerRef}>
            <Shield className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="ค้นหา บ.ประกัน (พิมพ์ชื่อ/รหัส)..."
              value={insuranceInput}
              onChange={e => handleInsuranceInputChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              className="pl-8 pr-7 h-9 text-xs bg-white"
            />
            {insuranceInput && (
              <button
                type="button"
                onClick={handleClearInsurance}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-full"
                title="ล้างการค้นหาประกัน"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Suggestions Dropdown */}
            {showSuggestions && insuranceSuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg text-xs animate-in fade-in duration-100">
                <div className="px-2 py-1 text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">
                  บริษัทประกัน ({insuranceSuggestions.length} รายการ)
                </div>
                {insuranceSuggestions.map(ins => (
                  <button
                    key={ins.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(ins)}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-teal-50 hover:text-[#0d9488] transition-colors flex items-center justify-between"
                  >
                    <span className="font-medium truncate mr-2">{ins.name}</span>
                    <span className="text-[10px] font-mono text-[#94a3b8] shrink-0">
                      {ins.peakCustomerId || ins.id}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Invoice Status Filter */}
          <Select
            value={filters.status}
            onChange={e => onChange('status', e.target.value)}
            className="w-48 h-9 text-xs"
          >
            {AR_STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          {/* Global Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="ค้นหา Invoice / เคลม / ทะเบียน / ผู้เอาประกัน..."
              value={filters.search}
              onChange={e => onChange('search', e.target.value)}
              className="pl-8 h-9 text-xs bg-white"
            />
          </div>

          {/* Reset Filters */}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setInsuranceInput('')
                onReset()
              }}
              className="h-9 px-2.5 text-xs text-[#64748b] hover:text-[#0f172a] gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              รีเซ็ต
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
