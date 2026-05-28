"use client"

import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface PartItem {
  id: string
  partNo: string
  partName: string
  standardPrice?: number | null
}

interface PartAutocompleteProps {
  value: string
  partsMaster: PartItem[]
  onChange: (val: string) => void
  onSelect: (part: { partNo: string; partName: string; standardPrice?: number }) => void
  className?: string
  placeholder?: string
}

export function PartAutocomplete({
  value,
  partsMaster,
  onChange,
  onSelect,
  className,
  placeholder = "พิมพ์ค้นหาอะไหล่..."
}: PartAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Filter parts based on input value
  const filtered = partsMaster.filter(pm => {
    const s = value.toLowerCase().trim()
    if (!s) return false // Only show suggestions when there is input
    return (
      pm.partName.toLowerCase().includes(s) ||
      pm.partNo.toLowerCase().includes(s)
    )
  }).slice(0, 15) // Limit to 15 items for performance and UX

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev - 1 + filtered.length) % filtered.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        const selected = filtered[highlightedIndex]
        onSelect({
          partNo: selected.partNo,
          partName: selected.partName,
          standardPrice: selected.standardPrice ?? undefined
        })
        setOpen(false)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <input
        type="text"
        value={value}
        onChange={e => {
          onChange(e.target.value)
          setOpen(true)
          setHighlightedIndex(0)
        }}
        onFocus={() => {
          setOpen(true)
          setHighlightedIndex(0)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "w-full bg-white border rounded px-2 py-1.5 text-sm outline-none focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]/20 transition-all shadow-sm",
          className
        )}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 text-slate-900 shadow-lg">
          {filtered.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelect({
                  partNo: item.partNo,
                  partName: item.partName,
                  standardPrice: item.standardPrice ?? undefined
                })
                setOpen(false)
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={cn(
                "w-full flex flex-col px-3 py-1.5 text-xs text-left hover:bg-slate-100 rounded-sm transition-colors",
                idx === highlightedIndex && "bg-slate-100 font-medium"
              )}
            >
              <span className="font-semibold text-slate-800 text-[13px]">{item.partName}</span>
              <span className="text-slate-500 font-mono text-[10px]">
                รหัส: {item.partNo} {item.standardPrice ? `| ราคากลาง: ฿${item.standardPrice}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
