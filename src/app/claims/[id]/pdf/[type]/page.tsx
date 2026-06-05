'use client'

import { useMemo, useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { formatDate } from '@/lib/date'
import { Button } from '@/components/ui/button'

const DEFAULT_COMPANY = {
  name: '',
  nameEn: '',
  taxId: '',
  branchCode: '00000',
  branchName: 'สำนักงานใหญ่',
  address: '',
  subDistrict: '',
  district: '',
  province: '',
  postalCode: '',
  phone: '',
  email: '',
  logoUrl: '',
  authorizedName: '',
  authorizedTitle: '',
  signatureUrl: '',
}

// Thai Baht Text Generator
function bahtText(num: number): string {
  const numberText = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']
  const unitText = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน']
  
  if (num === 0 || isNaN(num)) return 'ศูนย์บาทถ้วน'
  
  const str = num.toFixed(2).split('.')
  const baht = str[0]
  const satang = str[1]
  
  let bahtTextStr = ''
  
  const convert = (val: string) => {
    let result = ''
    const length = val.length
    for (let i = 0; i < length; i++) {
      const digit = parseInt(val.charAt(i), 10)
      const place = length - i - 1
      
      if (digit !== 0) {
        if (place === 1 && digit === 2) {
          result += 'ยี่'
        } else if (place === 1 && digit === 1) {
          result += ''
        } else if (place === 0 && digit === 1 && length > 1 && val.charAt(length - 2) !== '0') {
          result += 'เอ็ด'
        } else {
          result += numberText[digit]
        }
        result += unitText[place]
      }
    }
    return result
  }
  
  const convertBaht = (bahtStr: string) => {
    let result = ''
    const chunks = []
    let temp = bahtStr
    while (temp.length > 0) {
      const size = Math.min(6, temp.length)
      chunks.unshift(temp.substring(temp.length - size))
      temp = temp.substring(0, temp.length - size)
    }
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      result += convert(chunk)
      if (i < chunks.length - 1 && parseInt(chunk, 10) !== 0) {
        result += 'ล้าน'
      }
    }
    return result
  }
  
  bahtTextStr = convertBaht(baht)
  
  if (bahtTextStr !== '') {
    bahtTextStr += 'บาท'
  }
  
  if (satang === '00' || satang === '0') {
    bahtTextStr += 'ถ้วน'
  } else {
    bahtTextStr += convert(satang) + 'สตางค์'
  }
  
  return bahtTextStr
}

const formatCompanyAddress = (comp: any) => {
  if (!comp) return ''
  const address = comp.address || ''
  let subDistrict = comp.subDistrict || ''
  let district = comp.district || ''
  let province = comp.province || ''
  const postalCode = comp.postalCode || ''

  if (subDistrict || district || province || postalCode) {
    const isBkk = province.includes('กรุงเทพ') || province.toLowerCase().includes('bangkok')
    
    if (subDistrict) {
      if (!/^(ตำบล|ต\.|แขวง)/.test(subDistrict)) {
        subDistrict = (isBkk ? 'แขวง' : 'ตำบล') + subDistrict
      }
    }
    
    if (district) {
      if (!/^(อำเภอ|อ\.|เขต)/.test(district)) {
        district = (isBkk ? 'เขต' : 'อำเภอ') + district
      }
    }
    
    if (province) {
      if (!isBkk && !/^(จังหวัด|จ\.)/.test(province)) {
        province = 'จังหวัด' + province
      }
    }
    
    const parts = [
      address,
      subDistrict,
      district,
      province,
      postalCode
    ]
    return parts.filter(Boolean).join(' ')
  }
  
  return address
}

const getCompanyAddress = (comp: any) => {
  const formatted = formatCompanyAddress(comp)
  if (!formatted || formatted.trim() === '-') {
    return 'เลขที่ 622 ซอย ลาดพร้าว 47 (สะพาน 2) ถนน ลาดพร้าว แขวงสะพานสอง เขตวังทองหลาง กรุงเทพมหานคร 10310'
  }
  return formatted
}

export default function PDFMockPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const claimId = params.id as string
  const type = params.type as string
  const qtId = searchParams.get('qtId')
  const poId = searchParams.get('poId')
  const grId = searchParams.get('grId')

  const [claim, setClaim] = useState<any>(null)
  const [quotation, setQuotation] = useState<any>(null)
  const [po, setPo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState<any>(DEFAULT_COMPANY)

  const [editableItems, setEditableItems] = useState<any[]>([])
  const [editableNote, setEditableNote] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/claims/${claimId}`).then(res => res.json()),
      fetch('/api/settings/company').then(res => res.json()).catch(() => ({}))
    ]).then(([data, compData]) => {
      setClaim(data.error ? null : data)
      if (qtId && data.quotations) {
        setQuotation(data.quotations.find((q: any) => q.id === qtId))
      }
      if (poId && data.purchaseOrders) {
        setPo(data.purchaseOrders.find((p: any) => p.id === poId))
      }
      if (compData && compData.id) {
        setCompany(compData)
      }
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [claimId, qtId, poId])

  const hasPrinted = useRef(false)

  useEffect(() => {
    // Auto print when loaded — only once
    if (claim && !loading && !hasPrinted.current) {
      hasPrinted.current = true
      setTimeout(() => {
        window.print()
      }, 500)
    }
  }, [claim, loading])

  useEffect(() => {
    if (!claim) return

    if (type === 'delivery-note' && po) {
      let tempItems = (po.items || []).map((item: any) => {
        const originalFullPrice = item.discountPct < 100 
          ? Math.round((item.unitPrice / (1 - item.discountPct / 100)) * 100) / 100 
          : item.unitPrice
        return {
          id: item.id,
          partNo: item.partNo,
          description: item.description,
          quantity: item.quantity,
          unitPrice: originalFullPrice,
          discountPct: item.discountPct || 0,
          totalPrice: originalFullPrice * item.quantity * (1 - (item.discountPct || 0) / 100),
        }
      })
      let note = 'กรุณาตรวจนับอะไหล่ให้ครบถ้วนก่อนลงนามรับของ'

      if (grId) {
        const targetGR = (po.goodsReceipts || []).find((gr: any) => gr.id === grId)
        if (targetGR) {
          if (targetGR.note) {
            note = targetGR.note
          }
          tempItems = (targetGR.items || []).map((gi: any) => {
            const poItem = gi.poItem || po.items?.find((pi: any) => pi.id === gi.poItemId)
            const hasCustomPrice = gi.unitPrice !== undefined && gi.unitPrice !== null
            const originalFullPrice = hasCustomPrice
              ? gi.unitPrice
              : (poItem 
                  ? (poItem.discountPct < 100 ? Math.round((poItem.unitPrice / (1 - poItem.discountPct / 100)) * 100) / 100 : poItem.unitPrice)
                  : 0)
            const discountPct = gi.discountPct !== undefined && gi.discountPct !== null ? gi.discountPct : (poItem?.discountPct || 0)
            const totalPrice = originalFullPrice * gi.quantity * (1 - discountPct / 100)
            return {
              id: gi.id,
              partNo: poItem?.partNo || '',
              description: poItem?.description || 'รายการอะไหล่',
              quantity: gi.quantity,
              unitPrice: originalFullPrice,
              discountPct,
              totalPrice,
              isCustomPrice: hasCustomPrice,
            }
          })
        }
      }

      // Check if we should override unit prices with selling price (priceApprove) from claim parts!
      tempItems = tempItems.map((item: any) => {
        if (item.isCustomPrice) {
          return item
        }
        const matchingPart = (claim.parts || []).find((cp: any) => {
          const cpPartNo = (cp.partNo || '').trim()
          const itemPartNo = (item.partNo || '').trim()
          if (cpPartNo && itemPartNo && cpPartNo !== '-' && itemPartNo !== '-') {
            return cpPartNo === itemPartNo
          }
          return (cp.partName || '').trim().toLowerCase() === (item.description || '').trim().toLowerCase()
        })
        if (matchingPart) {
          // If we found a matching claim part, use its priceApprove (selling price) as the unitPrice!
          const sellingPrice = matchingPart.priceApprove
          return {
            ...item,
            unitPrice: sellingPrice,
            totalPrice: sellingPrice * item.quantity * (1 - (item.discountPct || 0) / 100)
          }
        }
        return item
      })

      setEditableItems(tempItems)
      setEditableNote(note)
    } else if (type === 'delivery-note-ar' && quotation) {
      const tempItems = [
        ...(quotation.laborItems || []).map((l: any) => ({
          id: l.id,
          partNo: '-',
          description: l.description,
          quantity: 1,
          unitPrice: l.unitPrice,
          discountPct: l.discountPct || 0,
          totalPrice: l.totalPrice,
        })),
        ...(quotation.partItems || []).map((p: any) => ({
          id: p.id,
          partNo: p.partNo || '-',
          description: p.partName,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          discountPct: p.discountPct || 0,
          totalPrice: p.totalPrice,
        }))
      ]
      setEditableItems(tempItems)
      setEditableNote(quotation.note || '')
    } else if ((type === 'insurance-invoice' || type === 'insurance-delivery-tax' || type === 'insurance-receipt') && claim.insuranceInvoice) {
      const shippingExpenses = (claim.expenses || []).filter((e: any) => {
        if (!e.billable) return false
        const cat = e.category?.toLowerCase() || ''
        const desc = e.description?.toLowerCase() || ''
        return (
          cat === 'shipping' ||
          cat === 'handling' ||
          cat === 'towing' ||
          desc.includes('ขนส่ง') ||
          desc.includes('shipping') ||
          desc.includes('ส่งอะไหล่') ||
          desc.includes('ค่าส่ง') ||
          desc.includes('ค่าขน')
        )
      })

      const tempItems = [
        ...(claim.labors || []).map((l: any) => {
          const discount = l.discountPct || 0
          const basePrice = l.priceOffer || (discount < 100 ? l.priceApprove / (1 - discount / 100) : l.priceApprove)
          return {
            id: l.id,
            partNo: '-',
            description: l.description,
            quantity: 1,
            unitPrice: basePrice,
            discountPct: discount,
            totalPrice: l.priceApprove,
          }
        }),
        ...(claim.parts || []).map((p: any) => {
          const discount = p.discountPct || 0
          const basePrice = p.priceOffer || (discount < 100 ? p.priceApprove / (1 - discount / 100) : p.priceApprove)
          return {
            id: p.id,
            partNo: p.partNo || '-',
            description: p.partName,
            quantity: p.quantity,
            unitPrice: basePrice,
            discountPct: discount,
            totalPrice: p.priceApprove * p.quantity,
          }
        }),
        ...shippingExpenses.map((exp: any) => ({
          id: exp.id,
          partNo: '-',
          description: exp.description || 'ค่าขนส่ง/ส่งอะไหล่',
          quantity: 1,
          unitPrice: exp.amount,
          discountPct: 0,
          totalPrice: exp.amount
        }))
      ]
      setEditableItems(tempItems)
      setEditableNote('')
    }
  }, [claim, po, quotation, type, grId])

  if (loading) return <div className="p-8 text-center animate-pulse">กำลังโหลดเอกสาร...</div>
  if (!claim) return <div className="p-8 text-center">ไม่พบข้อมูล Claim</div>

  const renderHeader = (title: string, docNo: string, date: string) => (
    <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
      <div className="flex gap-4">
        <div className="w-20 h-20 bg-gray-100 flex items-center justify-center font-bold text-gray-400 rounded overflow-hidden">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            'LOGO'
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
          <p className="text-xs text-gray-600 mt-1">{getCompanyAddress(company)}</p>
          <p className="text-xs text-gray-600">โทร. {company.phone} | เลขประจำตัวผู้เสียภาษี: {company.taxId} ({company.branchName})</p>
        </div>
      </div>
      <div className="text-right">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
          <span className="text-right">เลขที่เอกสาร:</span>
          <span className="font-semibold text-gray-900">{docNo}</span>
          <span className="text-right">วันที่:</span>
          <span className="font-semibold text-gray-900">{formatDate(date)}</span>
        </div>
      </div>
    </div>
  )

  const renderCustomerInfo = () => (
    <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
      <div className="border rounded p-4">
        <h3 className="font-semibold mb-2 border-b pb-1">ข้อมูลลูกค้า / ผู้เอาประกัน</h3>
        <p><span className="text-gray-500 w-24 inline-block">ชื่อ-นามสกุล:</span> {claim.insuredName}</p>
        <p><span className="text-gray-500 w-24 inline-block">ทะเบียนรถ:</span> {claim.carPlate}</p>
        <p><span className="text-gray-500 w-24 inline-block">ยี่ห้อ/รุ่น:</span> {claim.carBrand} {claim.carModel}</p>
        <p><span className="text-gray-500 w-24 inline-block">บริษัทประกัน:</span> {claim.insurance?.name}</p>
      </div>
      <div className="border rounded p-4">
        <h3 className="font-semibold mb-2 border-b pb-1">อ้างอิง</h3>
        <p><span className="text-gray-500 w-24 inline-block">Claim No:</span> {claim.claimNo}</p>
        <p><span className="text-gray-500 w-24 inline-block">วันที่รับรถ:</span> {formatDate(claim.createdAt)}</p>
      </div>
    </div>
  )

  if (type === 'quotation') {
    if (!quotation) return <div className="p-8 text-center">ไม่พบใบเสนอราคา</div>

    return (
      <div className="bg-white min-h-screen text-black p-8 max-w-4xl mx-auto print:p-12">
        {renderHeader('ใบเสนอราคา', quotation.quotationNo, quotation.quotationDate)}
        {renderCustomerInfo()}

        <table className="w-full text-sm mb-8 border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800 text-left">
              <th className="py-2 px-2">ลำดับ</th>
              <th className="py-2 px-2">รายการ</th>
              <th className="py-2 px-2 text-center">ประเภท</th>
              <th className="py-2 px-2 text-right">จำนวน</th>
              <th className="py-2 px-2 text-right">ราคา/หน่วย</th>
              <th className="py-2 px-2 text-right">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-gray-50"><td colSpan={6} className="py-1 px-2 font-semibold">รายการค่าแรง</td></tr>
            {(quotation.laborItems || []).map((l: any, i: number) => (
              <tr key={l.id} className="border-b border-gray-200">
                <td className="py-2 px-2 text-gray-600">{i + 1}</td>
                <td className="py-2.5 px-2">{l.description}</td>
                <td className="py-2 px-2 text-center">ค่าแรง</td>
                <td className="py-2 px-2 text-right">1</td>
                <td className="py-2 px-2 text-right">{formatCurrency(l.unitPrice)}</td>
                <td className="py-2 px-2 text-right">{formatCurrency(l.totalPrice)}</td>
              </tr>
            ))}
            <tr className="bg-gray-50"><td colSpan={6} className="py-1 px-2 font-semibold">รายการค่าอะไหล่</td></tr>
            {(quotation.partItems || []).map((p: any, i: number) => (
              <tr key={p.id} className="border-b border-gray-200">
                <td className="py-2 px-2 text-gray-600">{i + 1}</td>
                <td className="py-2.5 px-2">{p.partName} <span className="text-gray-400 text-xs">({p.partNo})</span></td>
                <td className="py-2 px-2 text-center">อะไหล่</td>
                <td className="py-2 px-2 text-right">{p.quantity}</td>
                <td className="py-2 px-2 text-right">{formatCurrency(p.unitPrice)}</td>
                <td className="py-2 px-2 text-right">{formatCurrency(p.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm border rounded p-4">
            <div className="flex justify-between"><span className="text-gray-600">รวมค่าแรง</span><span>{formatCurrency(quotation.laborTotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">รวมค่าอะไหล่</span><span>{formatCurrency(quotation.partsTotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">มูลค่าก่อนภาษี</span><span>{formatCurrency(quotation.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">ภาษีมูลค่าเพิ่ม 7%</span><span>{formatCurrency(quotation.vatAmount)}</span></div>
            <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>ยอดรวมทั้งสิ้น</span><span>{formatCurrency(quotation.grandTotal)}</span></div>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-16 text-center text-sm">
          <div>
            <div className="border-b border-gray-400 w-48 mx-auto mb-2"></div>
            <p>ผู้เสนอราคา</p>
            <p className="text-gray-500 text-xs mt-1">วันที่ ____/____/____</p>
          </div>
          <div>
            <div className="border-b border-gray-400 w-48 mx-auto mb-2"></div>
            <p>ผู้อนุมัติ (บริษัทประกัน)</p>
            <p className="text-gray-500 text-xs mt-1">วันที่ ____/____/____</p>
          </div>
        </div>
      </div>
    )
  }


  if (type === 'purchase-order') {
    if (!po) return <div className="p-8 text-center">ไม่พบใบสั่งซื้อ</div>

    return (
      <div className="bg-white min-h-screen text-black p-8 max-w-4xl mx-auto print:p-12">
        {renderHeader('ใบสั่งซื้อ (Purchase Order)', po.poNo, po.createdAt)}

        <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
          <div className="border rounded p-4">
            <h3 className="font-semibold mb-2 border-b pb-1">ข้อมูลผู้จัดจำหน่าย (Vendor)</h3>
            <p><span className="text-gray-500 w-28 inline-block">ชื่อร้าน/บริษัท:</span> {po.vendor?.name}</p>
            <p><span className="text-gray-500 w-28 inline-block">ประเภท:</span> {po.poType === 'PARTS' ? 'อะไหล่' : 'ค่าแรง'}</p>
            <p><span className="text-gray-500 w-28 inline-block">การจัดส่ง:</span> {po.deliveryMode === 'DIRECT_TO_GARAGE' ? 'ส่งตรงอู่' : 'รับเอง'}</p>
            {po.deliveryAddress ? (
              <div className="mt-2 flex items-start text-xs border-t pt-2 border-dashed">
                <span className="text-gray-500 w-28 inline-block shrink-0">ที่อยู่จัดส่ง:</span>
                <span className="text-gray-900 font-semibold whitespace-pre-wrap flex-1">{po.deliveryAddress}</span>
              </div>
            ) : (
              po.deliveryMode === 'DIRECT_TO_GARAGE' && (
                <div className="mt-2 flex items-start text-xs border-t pt-2 border-dashed">
                  <span className="text-gray-500 w-28 inline-block shrink-0">ที่อยู่จัดส่ง:</span>
                  <span className="text-gray-900 font-semibold flex-1">{`${claim.garage?.name || ''}\n${claim.garage?.address || ''}`.trim() || '-'}</span>
                </div>
              )
            )}
          </div>
          <div className="border rounded p-4">
            <h3 className="font-semibold mb-2 border-b pb-1">อ้างอิง</h3>
            <p><span className="text-gray-500 w-24 inline-block">Claim No:</span> {claim.claimNo}</p>
            <p><span className="text-gray-500 w-24 inline-block">ทะเบียนรถ:</span> {claim.carPlate}</p>
            <p><span className="text-gray-500 w-24 inline-block">ยี่ห้อ/รุ่น:</span> {claim.carBrand} {claim.carModel}</p>
          </div>
        </div>

        <table className="w-full text-sm mb-8 border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800 text-left">
              <th className="py-2 px-2 w-12">ลำดับ</th>
              <th className="py-2 px-2">รหัสอะไหล่</th>
              <th className="py-2 px-2">รายการ</th>
              <th className="py-2 px-2 text-right">จำนวน</th>
              <th className="py-2 px-2 text-right">ราคา/หน่วย</th>
              <th className="py-2 px-2 text-right">ส่วนลด</th>
              <th className="py-2 px-2 text-right">รวม</th>
            </tr>
          </thead>
          <tbody>
            {(po.items || []).map((item: any, i: number) => {
              const originalFullPrice = item.discountPct < 100 
                ? Math.round((item.unitPrice / (1 - item.discountPct / 100)) * 100) / 100 
                : item.unitPrice
              return (
                <tr key={item.id} className="border-b border-gray-200">
                  <td className="py-2 px-2 text-gray-600">{i + 1}</td>
                  <td className="py-2 px-2 font-mono text-xs">{item.partNo && !/^c[a-z0-9]{24}$/i.test(item.partNo) ? item.partNo : ''}</td>
                  <td className="py-2 px-2">{item.description}</td>
                  <td className="py-2 px-2 text-right">{item.quantity}</td>
                  <td className="py-2 px-2 text-right">{formatCurrency(originalFullPrice)}</td>
                  <td className="py-2 px-2 text-right">{item.discountPct > 0 ? `${item.discountPct}%` : '-'}</td>
                  <td className="py-2 px-2 text-right">{formatCurrency(item.totalPrice)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm border rounded p-4">
            <div className="flex justify-between text-gray-600">
              <span>ยอดรวมก่อน VAT</span>
              <span>{formatCurrency((po.items || []).reduce((s: number, item: any) => s + (item.totalPrice || 0), 0))}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>VAT 7%</span>
              <span>{formatCurrency(Math.round(((po.items || []).reduce((s: number, item: any) => s + (item.totalPrice || 0), 0)) * 0.07))}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
              <span>ยอดรวมทั้งสิ้น</span>
              <span>{formatCurrency(po.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 text-sm border rounded p-4 bg-gray-50">
          <h4 className="font-semibold mb-1">หมายเหตุ</h4>
          <p className="text-gray-600">กรุณาจัดส่งอะไหล่ตามรายการข้างต้น</p>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-16 text-center text-sm">
          <div>
            <div className="border-b border-gray-400 w-48 mx-auto mb-2 mt-12"></div>
            <p>ผู้สั่งซื้อ</p>
            <p className="text-gray-500 text-xs mt-1">วันที่ {formatDate(po.createdAt)}</p>
          </div>
          <div>
            {company.signatureUrl ? (
              <div className="w-48 h-12 mx-auto mb-2 border-b border-gray-400 flex items-end justify-center pb-1">
                <img src={company.signatureUrl} alt="Signature" className="max-h-16 object-contain mix-blend-multiply" />
              </div>
            ) : (
              <div className="border-b border-gray-400 w-48 mx-auto mb-2 mt-12"></div>
            )}
            <p>{company.authorizedName || 'ผู้อนุมัติ'}</p>
            {company.authorizedTitle && <p className="text-gray-500 text-xs mt-0.5">{company.authorizedTitle}</p>}
            <p className="text-gray-500 text-xs mt-1">วันที่ {formatDate(po.createdAt)}</p>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'delivery-note') {
    if (!po) return <div className="p-8 text-center">ไม่พบใบสั่งซื้อ</div>

    let documentDate = po.createdAt
    let titleText = 'ใบส่งของ/ใบส่งมอบสินค้า'

    if (grId) {
      const targetGR = (po.goodsReceipts || []).find((gr: any) => gr.id === grId)
      if (targetGR) {
        documentDate = targetGR.receivedAt
        titleText = 'ใบส่งของ/ใบส่งมอบสินค้า'
      }
    }

    const docNo = po.poNo.replace(/^PO-?/i, 'DO-')

    // Fallback company details
    const sellerName = company.name || 'บริษัท ดับเบิ้ล เอส.เอ็ม. จำกัด'
    const sellerAddress = getCompanyAddress(company)
    const sellerTaxId = company.taxId || '0105553036240'
    const sellerPhone = company.phone || '093-140-0898'
    const sellerEmail = company.email || 'salesdoublesm@gmail.com'

    const customerName = claim.insurance?.name || claim.insuredName || ''
    const customerAddress = claim.insurance?.address || ''
    const customerTaxId = claim.insurance?.taxId || ''
    const customerBranch = claim.insurance?.branchCode ? (claim.insurance.branchCode === '00000' ? 'สำนักงานใหญ่' : `สาขา ${claim.insurance.branchCode}`) : 'สำนักงานใหญ่'

    const subtotal = editableItems.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0)
    const vatAmount = Math.round(subtotal * 0.07 * 100) / 100
    const grandTotal = Math.round((subtotal + vatAmount) * 100) / 100

    return (
      <div className="bg-white min-h-screen text-black p-8 max-w-4xl mx-auto print:p-6 font-sans relative overflow-hidden print:overflow-visible">
        
        {/* CSS for watermark and font */}
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap');
          .font-sans {
            font-family: 'Sarabun', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }
          @media print {
            .print-no-break {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          }
        `}</style>

        {/* Edit Toolbar for screen only */}
        <div className="print:hidden bg-slate-100 p-4 mb-4 rounded-xl flex items-center justify-between border border-slate-200">
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
              📄 โหมดพิมพ์เอกสาร
            </span>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isEditMode}
                onChange={e => setIsEditMode(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
              />
              <span className="font-semibold text-slate-700">เปิดโหมดแก้ไขราคาก่อนพิมพ์ (ราคาขาย)</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition" onClick={() => window.print()}>
              🖨️ สั่งพิมพ์เอกสาร
            </button>
          </div>
        </div>

        {/* Header section */}
        <div className="flex justify-between items-start mb-6 print:mb-3 z-10 relative">
          <div className="flex gap-4">
            <div className="w-20 h-20 bg-gray-100 flex items-center justify-center font-bold text-gray-400 rounded overflow-hidden border">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <svg className="w-16 h-16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2050/svg">
                  <path d="M20 55C20 55 24 45 40 40C56 35 78 40 85 45C92 50 90 55 90 55H20Z" fill="#0d9488" />
                  <circle cx="35" cy="55" r="8" fill="#f97316" stroke="white" strokeWidth="2" />
                  <circle cx="75" cy="55" r="8" fill="#f97316" stroke="white" strokeWidth="2" />
                  <text x="50%" y="85" dominantBaseline="middle" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a" fontFamily="sans-serif">SSM</text>
                </svg>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{sellerName}</h1>
              <p className="text-[10px] text-gray-500 font-semibold tracking-wider mb-1">CO., LTD.</p>
              <p className="text-xs text-gray-600 mt-1 max-w-md leading-relaxed">{sellerAddress}</p>
              <p className="text-xs text-gray-600">โทร. {sellerPhone} | อีเมล: {sellerEmail}</p>
              <p className="text-xs text-gray-600">เลขประจำตัวผู้เสียภาษี: {sellerTaxId} (สำนักงานใหญ่)</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">หน้า 1/1 (ต้นฉบับ)</div>
            <h2 className="text-2xl font-bold text-teal-700 tracking-wide">{titleText}</h2>
            <div className="mt-3 bg-teal-50/50 border border-teal-150 rounded-xl p-3 text-left text-xs space-y-1.5 min-w-[240px]">
              <div className="flex justify-between">
                <span className="text-gray-500">เลขที่เอกสาร:</span>
                <span className="font-semibold text-gray-955">{docNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">วันที่ออก:</span>
                <span className="font-semibold text-gray-955">{formatDate(documentDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">วันที่ตอบรับ:</span>
                <span className="font-semibold text-gray-955">-</span>
              </div>
              <div className="flex justify-between border-t border-teal-100/50 pt-1.5 mt-1.5">
                <span className="text-gray-500">เลขเคลม:</span>
                <span className="font-semibold text-teal-800">{claim.claimNo}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Info Grid */}
        <div className="grid grid-cols-2 gap-8 print:gap-4 mb-6 print:mb-3 text-xs z-10 relative">
          <div className="border rounded-xl p-4 bg-slate-50/30">
            <h3 className="font-bold text-gray-800 mb-2 border-b pb-1 text-teal-700">ลูกค้า / บริษัทประกัน</h3>
            <p className="font-semibold">{customerName}</p>
            {customerAddress && <p className="text-gray-600 mt-1 leading-relaxed">{customerAddress}</p>}
            {customerTaxId && <p className="text-gray-600 mt-1">เลขประจำตัวผู้เสียภาษี: {customerTaxId} ({customerBranch})</p>}
          </div>
          <div className="border rounded-xl p-4 bg-slate-50/30">
            <h3 className="font-bold text-gray-800 mb-2 border-b pb-1 text-teal-700">สถานที่จัดส่ง (ที่อยู่ส่งของ)</h3>
            {po.deliveryAddress ? (
              <p className="font-semibold whitespace-pre-wrap leading-relaxed">{po.deliveryAddress}</p>
            ) : (
              <>
                <p className="font-semibold">{claim.garage?.name || 'ไม่ระบุอู่'}</p>
                {claim.garage?.address && <p className="text-gray-600 mt-1 leading-relaxed">{claim.garage.address}</p>}
                {claim.garage?.phone && <p className="text-gray-600 mt-1">โทร: {claim.garage.phone}</p>}
              </>
            )}
            <div className="border-t border-dashed border-gray-200 mt-2 pt-2 space-y-0.5">
              <p className="text-gray-600">ยี่ห้อ/รุ่น รถ: {claim.carBrand} {claim.carModel}</p>
              <p className="text-gray-600">ทะเบียนรถ: {claim.carPlate}</p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="z-10 relative">
          <table className="w-full text-xs mb-6 print:mb-3 border-collapse">
            <thead>
              <tr className="bg-teal-50/70 border-b border-teal-200 text-left text-teal-800 font-bold">
                <th className="py-2.5 print:py-1.5 px-2 text-center w-10">ลำดับ</th>
                <th className="py-2.5 print:py-1.5 px-2">รายการ</th>
                <th className="py-2.5 print:py-1.5 px-2 text-right w-16">จำนวน</th>
                <th className="py-2.5 print:py-1.5 px-2 text-right w-24">ราคาขาย/หน่วย</th>
                <th className="py-2.5 print:py-1.5 px-2 text-right w-20">ส่วนลด</th>
                <th className="py-2.5 print:py-1.5 px-2 text-center w-12">VAT</th>
                <th className="py-2.5 print:py-1.5 px-2 text-right w-28">มูลค่าก่อนภาษี</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150">
              {editableItems.map((item: any, i: number) => {
                const subtotal = item.totalPrice
                const priceBeforeDiscount = item.unitPrice
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 print:py-1 px-2 text-center text-gray-550">{i + 1}</td>
                    <td className="py-2.5 print:py-1 px-2 text-gray-900 font-medium">
                      {isEditMode ? (
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => {
                            const newItems = [...editableItems]
                            newItems[i].description = e.target.value
                            setEditableItems(newItems)
                          }}
                          className="w-full bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-teal-500 rounded px-1.5 py-0.5 text-xs text-gray-900"
                        />
                      ) : (
                        <>
                          {item.description}
                          {item.partNo && item.partNo !== '-' && !/^c[a-z0-9]{24}$/i.test(item.partNo) && (
                            <span className="text-gray-400 font-mono text-[10px] block mt-0.5">({item.partNo})</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="py-2.5 print:py-1 px-2 text-right text-gray-700 font-mono">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => {
                            const newItems = [...editableItems]
                            const q = Number(e.target.value) || 0
                            newItems[i].quantity = q
                            newItems[i].totalPrice = q * newItems[i].unitPrice * (1 - (newItems[i].discountPct || 0) / 100)
                            setEditableItems(newItems)
                          }}
                          className="w-16 text-center bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-teal-500 rounded px-1 py-0.5 text-xs font-mono"
                        />
                      ) : (
                        Number(item.quantity).toFixed(2)
                      )}
                    </td>
                    <td className="py-2.5 print:py-1 px-2 text-right text-gray-700 font-mono">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={e => {
                            const newItems = [...editableItems]
                            const p = Number(e.target.value) || 0
                            newItems[i].unitPrice = p
                            newItems[i].totalPrice = newItems[i].quantity * p * (1 - (newItems[i].discountPct || 0) / 100)
                            setEditableItems(newItems)
                          }}
                          className="w-24 text-right bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-teal-500 rounded px-1 py-0.5 text-xs font-mono"
                        />
                      ) : (
                        formatCurrency(priceBeforeDiscount)
                      )}
                    </td>
                    <td className="py-2.5 print:py-1 px-2 text-right text-gray-700 font-mono">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={item.discountPct}
                          onChange={e => {
                            const newItems = [...editableItems]
                            const d = Number(e.target.value) || 0
                            newItems[i].discountPct = d
                            newItems[i].totalPrice = newItems[i].quantity * newItems[i].unitPrice * (1 - d / 100)
                            setEditableItems(newItems)
                          }}
                          className="w-16 text-center bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-teal-500 rounded px-1 py-0.5 text-xs font-mono"
                        />
                      ) : (
                        item.discountPct > 0 ? `${Number(item.discountPct).toFixed(2)}%` : '-'
                      )}
                    </td>
                    <td className="py-2.5 print:py-1 px-2 text-center text-gray-700">7%</td>
                    <td className="py-2.5 print:py-1 px-2 text-right text-gray-900 font-mono font-medium">{formatCurrency(subtotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals & Summary Block */}
        <div className="grid grid-cols-[1fr_320px] gap-8 mb-8 print:mb-4 text-xs z-10 relative print-no-break">
          
          {/* Left Side: Baht Text & Notes */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-t pt-3">
              <span className="font-bold text-gray-750">จำนวนเงินทั้งสิ้น (ตัวอักษร):</span>
              <span className="font-semibold text-teal-800 italic">({bahtText(grandTotal)})</span>
            </div>
            {isEditMode ? (
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <span className="font-bold text-gray-750 block mb-1">หมายเหตุ:</span>
                <textarea
                  value={editableNote}
                  onChange={e => setEditableNote(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:ring-1 focus:ring-teal-500 rounded p-2 text-xs text-gray-700 font-medium leading-relaxed"
                  rows={2}
                />
              </div>
            ) : (
              editableNote && (
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                  <span className="font-bold text-gray-750 block mb-1">หมายเหตุ:</span>
                  <p className="text-gray-600 whitespace-pre-wrap">{editableNote}</p>
                </div>
              )
            )}
          </div>

          {/* Right Side: Totals */}
          <div className="bg-teal-50/40 border border-teal-100/70 rounded-xl p-4 space-y-2 font-medium">
            <div className="flex justify-between text-gray-600">
              <span>มูลค่าไม่มีหรือยกเว้นภาษี:</span>
              <span className="font-mono text-gray-900">0.00</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>มูลค่าที่คำนวณภาษี 7%:</span>
              <span className="font-mono text-gray-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>ภาษีมูลค่าเพิ่ม 7%:</span>
              <span className="font-mono text-gray-900">{formatCurrency(vatAmount)}</span>
            </div>
            <div className="flex justify-between text-teal-900 font-bold border-t border-teal-100 pt-2">
              <span>จำนวนเงินทั้งสิ้น:</span>
              <span className="font-mono text-base">{formatCurrency(grandTotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-[10px] border-t border-dashed pt-1.5">
              <span>จำนวนเงินถูกหัก ณ ที่จ่าย:</span>
              <span className="font-mono">0.00</span>
            </div>
            <div className="flex justify-between text-teal-900 font-bold border-t border-teal-200 pt-2 text-sm">
              <span>จำนวนเงินที่ชำระ:</span>
              <span className="font-mono text-base">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Warning Remark */}
        <div className="border border-rose-100 rounded-xl p-3 bg-rose-50/30 text-xs text-rose-600 font-semibold mb-8 print:mb-4 z-10 relative">
          * กรุณาตรวจสอบสินค้าที่ได้รับหากพ้นกำหนด 7 วันนับจากวันที่ส่งสินค้า ทางร้านจะไม่รับเปลี่ยนหรือคืน
        </div>

        {/* Signatures Footer */}
        <div className="grid grid-cols-3 gap-4 text-center text-xs z-10 relative print-no-break mt-4">
          <div>
            <div className="border-b border-gray-400 w-36 mx-auto mb-2 mt-4 print:mt-2"></div>
            <p className="font-bold text-gray-800">ผู้รับสินค้า</p>
            <p className="text-gray-500 text-[10px] mt-1">วันที่ ____/____/____</p>
          </div>
          <div>
            <div className="border-b border-gray-400 w-36 mx-auto mb-2 mt-4 print:mt-2"></div>
            <p className="font-bold text-gray-800">ผู้รับเงิน</p>
            <p className="text-gray-500 text-[10px] mt-1">วันที่ ____/____/____</p>
          </div>
          <div>
            <div className="border-b border-gray-400 w-36 mx-auto mb-2 mt-4 print:mt-2"></div>
            <p className="font-bold text-gray-800">ผู้ออกเอกสาร</p>
            <p className="text-gray-500 text-[10px] mt-1">วันที่ ____/____/____</p>
          </div>
        </div>

      </div>
    )
  }

  if (type === 'delivery-note-ar') {
    if (!quotation) return <div className="p-8 text-center">ไม่พบใบเสนอราคา</div>

    const docNo = quotation.quotationNo.replace(/^QO-?/i, 'DO-')
    const documentDate = quotation.quotationDate
    const validUntil = quotation.validUntil

    // Fallback company details
    const sellerName = company.name || 'บริษัท ดับเบิ้ล เอส.เอ็ม. จำกัด'
    const sellerAddress = getCompanyAddress(company)
    const sellerTaxId = company.taxId || '0105553036240'
    const sellerPhone = company.phone || '093-140-0898'
    const sellerEmail = company.email || 'salesdoublesm@gmail.com'

    const customerName = claim.insurance?.name || claim.insuredName || ''
    const customerAddress = claim.insurance?.address || ''
    const customerTaxId = claim.insurance?.taxId || ''
    const customerBranch = claim.insurance?.branchCode ? (claim.insurance.branchCode === '00000' ? 'สำนักงานใหญ่' : `สาขา ${claim.insurance.branchCode}`) : 'สำนักงานใหญ่'

    const subtotal = editableItems.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0)
    const vatAmount = Math.round(subtotal * 0.07 * 100) / 100
    const grandTotal = Math.round((subtotal + vatAmount) * 100) / 100

    return (
      <div className="bg-white min-h-screen text-black p-8 max-w-4xl mx-auto print:p-6 font-sans relative overflow-hidden print:overflow-visible">
        
        {/* CSS for watermark and font */}
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap');
          .font-sans {
            font-family: 'Sarabun', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }
          @media print {
            .print-no-break {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          }
        `}</style>

        {/* Edit Toolbar for screen only */}
        <div className="print:hidden bg-slate-100 p-4 mb-4 rounded-xl flex items-center justify-between border border-slate-200">
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
              📄 โหมดพิมพ์เอกสาร
            </span>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isEditMode}
                onChange={e => setIsEditMode(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
              />
              <span className="font-semibold text-slate-700">เปิดโหมดแก้ไขราคาก่อนพิมพ์ (ราคาขาย)</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition" onClick={() => window.print()}>
              🖨️ สั่งพิมพ์เอกสาร
            </button>
          </div>
        </div>

        {/* Header section */}
        <div className="flex justify-between items-start mb-6 print:mb-3 z-10 relative">
          <div className="flex gap-4">
            <div className="w-20 h-20 bg-gray-100 flex items-center justify-center font-bold text-gray-400 rounded overflow-hidden border">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <svg className="w-16 h-16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 55C20 55 24 45 40 40C56 35 78 40 85 45C92 50 90 55 90 55H20Z" fill="#0d9488" />
                  <circle cx="35" cy="55" r="8" fill="#f97316" stroke="white" strokeWidth="2" />
                  <circle cx="75" cy="55" r="8" fill="#f97316" stroke="white" strokeWidth="2" />
                  <text x="50%" y="85" dominantBaseline="middle" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a" fontFamily="sans-serif">SSM</text>
                </svg>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{sellerName}</h1>
              <p className="text-[10px] text-gray-500 font-semibold tracking-wider mb-1">CO., LTD.</p>
              <p className="text-xs text-gray-600 mt-1 max-w-md leading-relaxed">{sellerAddress}</p>
              <p className="text-xs text-gray-600">โทร. {sellerPhone} | อีเมล: {sellerEmail}</p>
              <p className="text-xs text-gray-600">เลขประจำตัวผู้เสียภาษี: {sellerTaxId} (สำนักงานใหญ่)</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">หน้า 1/1 (ต้นฉบับ)</div>
            <h2 className="text-2xl font-bold text-teal-700 tracking-wide">ใบส่งของ/ใบส่งมอบสินค้า</h2>
            <div className="mt-3 bg-teal-50/50 border border-teal-150 rounded-xl p-3 text-left text-xs space-y-1.5 min-w-[240px]">
              <div className="flex justify-between">
                <span className="text-gray-500">เลขที่เอกสาร:</span>
                <span className="font-semibold text-gray-955">{docNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">วันที่ออก:</span>
                <span className="font-semibold text-gray-955">{formatDate(documentDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">วันที่ตอบรับ:</span>
                <span className="font-semibold text-gray-955">-</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ใช้ได้ถึง:</span>
                <span className="font-semibold text-gray-955">{formatDate(validUntil)}</span>
              </div>
              <div className="flex justify-between border-t border-teal-100/50 pt-1.5 mt-1.5">
                <span className="text-gray-500">เลขเคลม:</span>
                <span className="font-semibold text-teal-800">{claim.claimNo}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Info Grid */}
        <div className="grid grid-cols-2 gap-8 print:gap-4 mb-6 print:mb-3 text-xs z-10 relative">
          <div className="border rounded-xl p-4 bg-slate-50/30">
            <h3 className="font-bold text-gray-800 mb-2 border-b pb-1 text-teal-700">ลูกค้า / บริษัทประกัน</h3>
            <p className="font-semibold">{customerName}</p>
            {customerAddress && <p className="text-gray-600 mt-1 leading-relaxed">{customerAddress}</p>}
            {customerTaxId && <p className="text-gray-600 mt-1">เลขประจำตัวผู้เสียภาษี: {customerTaxId} ({customerBranch})</p>}
          </div>
          <div className="border rounded-xl p-4 bg-slate-50/30">
            <h3 className="font-bold text-gray-800 mb-2 border-b pb-1 text-teal-700">สถานที่จัดส่ง (ที่อยู่ส่งของ)</h3>
            <p className="font-semibold">{claim.garage?.name || 'ไม่ระบุอู่'}</p>
            {claim.garage?.address && <p className="text-gray-600 mt-1 leading-relaxed">{claim.garage.address}</p>}
            {claim.garage?.phone && <p className="text-gray-600 mt-1">โทร: {claim.garage.phone}</p>}
            <div className="border-t border-dashed border-gray-200 mt-2 pt-2 space-y-0.5">
              <p className="text-gray-600">ยี่ห้อ/รุ่น รถ: {claim.carBrand} {claim.carModel}</p>
              <p className="text-gray-600">ทะเบียนรถ: {claim.carPlate}</p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="z-10 relative">
          <table className="w-full text-xs mb-6 print:mb-3 border-collapse">
            <thead>
              <tr className="bg-teal-50/70 border-b border-teal-200 text-left text-teal-800 font-bold">
                <th className="py-2.5 print:py-1.5 px-2 text-center w-10">ลำดับ</th>
                <th className="py-2.5 print:py-1.5 px-2">รายการ</th>
                <th className="py-2.5 print:py-1.5 px-2 text-right w-16">จำนวน</th>
                <th className="py-2.5 print:py-1.5 px-2 text-right w-24">ราคาขาย/หน่วย</th>
                <th className="py-2.5 print:py-1.5 px-2 text-right w-20">ส่วนลด</th>
                <th className="py-2.5 print:py-1.5 px-2 text-center w-12">VAT</th>
                <th className="py-2.5 print:py-1.5 px-2 text-right w-28">มูลค่าก่อนภาษี</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150">
              {editableItems.map((item: any, i: number) => {
                const subtotal = item.totalPrice
                const priceBeforeDiscount = item.unitPrice
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 print:py-1 px-2 text-center text-gray-550">{i + 1}</td>
                    <td className="py-2.5 print:py-1 px-2 text-gray-900 font-medium">
                      {isEditMode ? (
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => {
                            const newItems = [...editableItems]
                            newItems[i].description = e.target.value
                            setEditableItems(newItems)
                          }}
                          className="w-full bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-teal-500 rounded px-1.5 py-0.5 text-xs text-gray-900"
                        />
                      ) : (
                        <>
                          {item.description}
                          {item.partNo && item.partNo !== '-' && !/^c[a-z0-9]{24}$/i.test(item.partNo) && (
                            <span className="text-gray-400 font-mono text-[10px] block mt-0.5">({item.partNo})</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="py-2.5 print:py-1 px-2 text-right text-gray-700 font-mono">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => {
                            const newItems = [...editableItems]
                            const q = Number(e.target.value) || 0
                            newItems[i].quantity = q
                            newItems[i].totalPrice = q * newItems[i].unitPrice * (1 - (newItems[i].discountPct || 0) / 100)
                            setEditableItems(newItems)
                          }}
                          className="w-16 text-center bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-teal-500 rounded px-1 py-0.5 text-xs font-mono"
                        />
                      ) : (
                        Number(item.quantity).toFixed(2)
                      )}
                    </td>
                    <td className="py-2.5 print:py-1 px-2 text-right text-gray-700 font-mono">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={e => {
                            const newItems = [...editableItems]
                            const p = Number(e.target.value) || 0
                            newItems[i].unitPrice = p
                            newItems[i].totalPrice = newItems[i].quantity * p * (1 - (newItems[i].discountPct || 0) / 100)
                            setEditableItems(newItems)
                          }}
                          className="w-24 text-right bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-teal-500 rounded px-1 py-0.5 text-xs font-mono"
                        />
                      ) : (
                        formatCurrency(priceBeforeDiscount)
                      )}
                    </td>
                    <td className="py-2.5 print:py-1 px-2 text-right text-gray-700 font-mono">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={item.discountPct}
                          onChange={e => {
                            const newItems = [...editableItems]
                            const d = Number(e.target.value) || 0
                            newItems[i].discountPct = d
                            newItems[i].totalPrice = newItems[i].quantity * newItems[i].unitPrice * (1 - d / 100)
                            setEditableItems(newItems)
                          }}
                          className="w-16 text-center bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-teal-500 rounded px-1 py-0.5 text-xs font-mono"
                        />
                      ) : (
                        item.discountPct > 0 ? `${Number(item.discountPct).toFixed(2)}%` : '-'
                      )}
                    </td>
                    <td className="py-2.5 print:py-1 px-2 text-center text-gray-700">7%</td>
                    <td className="py-2.5 print:py-1 px-2 text-right text-gray-900 font-mono font-medium">{formatCurrency(subtotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals & Summary Block */}
        <div className="grid grid-cols-[1fr_320px] gap-8 mb-8 print:mb-4 text-xs z-10 relative print-no-break">
          
          {/* Left Side: Baht Text & Notes */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-t pt-3">
              <span className="font-bold text-gray-750">จำนวนเงินทั้งสิ้น (ตัวอักษร):</span>
              <span className="font-semibold text-teal-800 italic">({bahtText(grandTotal)})</span>
            </div>
            {isEditMode ? (
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <span className="font-bold text-gray-750 block mb-1">หมายเหตุ:</span>
                <textarea
                  value={editableNote}
                  onChange={e => setEditableNote(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:ring-1 focus:ring-teal-500 rounded p-2 text-xs text-gray-700 font-medium leading-relaxed"
                  rows={2}
                />
              </div>
            ) : (
              editableNote && (
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                  <span className="font-bold text-gray-750 block mb-1">หมายเหตุ:</span>
                  <p className="text-gray-600 whitespace-pre-wrap">{editableNote}</p>
                </div>
              )
            )}
          </div>

          {/* Right Side: Totals */}
          <div className="bg-teal-50/40 border border-teal-100/70 rounded-xl p-4 space-y-2 font-medium">
            <div className="flex justify-between text-gray-600">
              <span>มูลค่าไม่มีหรือยกเว้นภาษี:</span>
              <span className="font-mono text-gray-900">0.00</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>มูลค่าที่คำนวณภาษี 7%:</span>
              <span className="font-mono text-gray-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>ภาษีมูลค่าเพิ่ม 7%:</span>
              <span className="font-mono text-gray-900">{formatCurrency(vatAmount)}</span>
            </div>
            <div className="flex justify-between text-teal-900 font-bold border-t border-teal-100 pt-2">
              <span>จำนวนเงินทั้งสิ้น:</span>
              <span className="font-mono text-base">{formatCurrency(grandTotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-[10px] border-t border-dashed pt-1.5">
              <span>จำนวนเงินถูกหัก ณ ที่จ่าย:</span>
              <span className="font-mono">0.00</span>
            </div>
            <div className="flex justify-between text-teal-900 font-bold border-t border-teal-200 pt-2 text-sm">
              <span>จำนวนเงินที่ชำระ:</span>
              <span className="font-mono text-base">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Warning Remark */}
        <div className="border border-rose-100 rounded-xl p-3 bg-rose-50/30 text-xs text-rose-600 font-semibold mb-8 print:mb-4 z-10 relative">
          * กรุณาตรวจสอบสินค้าที่ได้รับหากพ้นกำหนด 7 วันนับจากวันที่ส่งสินค้า ทางร้านจะไม่รับเปลี่ยนหรือคืน
        </div>

        {/* Signatures Footer */}
        <div className="grid grid-cols-3 gap-4 text-center text-xs z-10 relative print-no-break mt-4">
          <div>
            <div className="border-b border-gray-400 w-36 mx-auto mb-2 mt-4 print:mt-2"></div>
            <p className="font-bold text-gray-800">ผู้รับสินค้า</p>
            <p className="text-gray-500 text-[10px] mt-1">วันที่ ____/____/____</p>
          </div>
          <div>
            <div className="border-b border-gray-400 w-36 mx-auto mb-2 mt-4 print:mt-2"></div>
            <p className="font-bold text-gray-800">ผู้รับเงิน</p>
            <p className="text-gray-500 text-[10px] mt-1">วันที่ ____/____/____</p>
          </div>
          <div>
            <div className="border-b border-gray-400 w-36 mx-auto mb-2 mt-4 print:mt-2"></div>
            <p className="font-bold text-gray-800">ผู้ออกเอกสาร</p>
            <p className="text-gray-500 text-[10px] mt-1">วันที่ ____/____/____</p>
          </div>
        </div>

      </div>
    )
  }

  if (type === 'insurance-invoice' || type === 'insurance-delivery-tax' || type === 'insurance-receipt') {
    const inv = claim.insuranceInvoice
    if (!inv) return <div className="p-8 text-center">ยังไม่ได้ออกใบวางบิล</div>

    const docNo = inv.invoiceNo
    const documentDate = inv.invoiceDate

    // Fallback company details
    const sellerName = company.name || 'บริษัท ดับเบิ้ล เอส.เอ็ม. จำกัด'
    const sellerAddress = getCompanyAddress(company)
    const sellerTaxId = company.taxId || '0105553036240'
    const sellerPhone = company.phone || '093-140-0898'
    const sellerEmail = company.email || 'salesdoublesm@gmail.com'

    const customerName = claim.insurance?.name || claim.insuredName || ''
    const customerAddress = claim.insurance?.address || ''
    const customerTaxId = claim.insurance?.taxId || ''
    const customerBranch = claim.insurance?.branchCode ? (claim.insurance.branchCode === '00000' ? 'สำนักงานใหญ่' : `สาขา ${claim.insurance.branchCode}`) : 'สำนักงานใหญ่'

    const subtotal = editableItems.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0)
    const vatAmount = Math.round(subtotal * 0.07 * 100) / 100
    const grandTotal = Math.round((subtotal + vatAmount) * 100) / 100

    const isDeliveryTax = type === 'insurance-delivery-tax'
    const isReceipt = type === 'insurance-receipt'
    const isInvoice = type === 'insurance-invoice'

    let mainTitle = ''
    if (isDeliveryTax) mainTitle = 'ใบส่งของ/ใบกำกับภาษี'
    else if (isReceipt) mainTitle = 'ใบเสร็จรับเงิน'
    else if (isInvoice) mainTitle = 'ใบวางบิล / ใบแจ้งหนี้'

    const renderSingleSheet = (isCopy: boolean) => {
      const copyLabel = isCopy ? 'สำเนา' : 'ต้นฉบับ'
      const sheetLabel = `เอกสารออกเป็นชุด (${copyLabel})`

      return (
        <div className="bg-white min-h-screen text-black p-8 max-w-4xl mx-auto print:p-6 font-sans relative overflow-hidden print:overflow-visible print-no-break">
          {/* Header section */}
          <div className="flex justify-between items-start mb-6 print:mb-3 z-10 relative">
            <div className="flex gap-4">
              <div className="w-20 h-20 bg-gray-100 flex items-center justify-center font-bold text-gray-400 rounded overflow-hidden border">
                {company.logoUrl ? (
                  <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <svg className="w-16 h-16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2050/svg">
                    <path d="M20 55C20 55 24 45 40 40C56 35 78 40 85 45C92 50 90 55 90 55H20Z" fill="#0d9488" />
                    <circle cx="35" cy="55" r="8" fill="#f97316" stroke="white" strokeWidth="2" />
                    <circle cx="75" cy="55" r="8" fill="#f97316" stroke="white" strokeWidth="2" />
                    <text x="50%" y="85" dominantBaseline="middle" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a" fontFamily="sans-serif">SSM</text>
                  </svg>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{sellerName}</h1>
                <p className="text-[10px] text-gray-500 font-semibold tracking-wider mb-1">CO., LTD.</p>
                <p className="text-xs text-gray-600 mt-1 max-w-md leading-relaxed">{sellerAddress}</p>
                <p className="text-xs text-gray-600">โทร. {sellerPhone} | อีเมล: {sellerEmail}</p>
                <p className="text-xs text-gray-600">เลขประจำตัวผู้เสียภาษี: {sellerTaxId} (สำนักงานใหญ่)</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">{sheetLabel}</div>
              <h2 className="text-2xl font-bold text-teal-700 tracking-wide">{mainTitle}</h2>
              <div className="mt-3 bg-teal-50/50 border border-teal-150 rounded-xl p-3 text-left text-xs space-y-1.5 min-w-[240px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">เลขที่เอกสาร:</span>
                  <span className="font-semibold text-gray-955">{docNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">วันที่ออก:</span>
                  <span className="font-semibold text-gray-955">{formatDate(documentDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">วันที่ตอบรับ:</span>
                  <span className="font-semibold text-gray-955">-</span>
                </div>
                <div className="flex justify-between border-t border-teal-100/50 pt-1.5 mt-1.5">
                  <span className="text-gray-500">เลขเคลม:</span>
                  <span className="font-semibold text-teal-800">{claim.claimNo}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Info Grid */}
          <div className="grid grid-cols-2 gap-8 print:gap-4 mb-6 print:mb-3 text-xs z-10 relative">
            <div className="border rounded-xl p-4 bg-slate-50/30">
              <h3 className="font-bold text-gray-800 mb-2 border-b pb-1 text-teal-700">ลูกค้า / บริษัทประกัน</h3>
              <p className="font-semibold">{customerName}</p>
              {customerAddress && <p className="text-gray-600 mt-1 leading-relaxed">{customerAddress}</p>}
              {customerTaxId && <p className="text-gray-600 mt-1">เลขประจำตัวผู้เสียภาษี: {customerTaxId} ({customerBranch})</p>}
            </div>
            <div className="border rounded-xl p-4 bg-slate-50/30">
              <h3 className="font-bold text-gray-800 mb-2 border-b pb-1 text-teal-700">สถานที่จัดส่ง (ที่อยู่ส่งของ)</h3>
              <p className="font-semibold">{claim.garage?.name || 'ไม่ระบุอู่'}</p>
              {claim.garage?.address && <p className="text-gray-600 mt-1 leading-relaxed">{claim.garage.address}</p>}
              {claim.garage?.phone && <p className="text-gray-600 mt-1">โทร: {claim.garage.phone}</p>}
              <div className="border-t border-dashed border-gray-200 mt-2 pt-2 space-y-0.5">
                <p className="text-gray-600">ยี่ห้อ/รุ่น รถ: {claim.carBrand} {claim.carModel}</p>
                <p className="text-gray-600">ทะเบียนรถ: {claim.carPlate}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="z-10 relative">
            <table className="w-full text-xs mb-6 print:mb-3 border-collapse">
              <thead>
                <tr className="bg-teal-50/70 border-b border-teal-200 text-left text-teal-800 font-bold">
                  <th className="py-2.5 print:py-1.5 px-2 text-center w-10">ลำดับ</th>
                  <th className="py-2.5 print:py-1.5 px-2">รายการ</th>
                  <th className="py-2.5 print:py-1.5 px-2 text-right w-16">จำนวน</th>
                  <th className="py-2.5 print:py-1.5 px-2 text-right w-24">ราคาขาย/หน่วย</th>
                  <th className="py-2.5 print:py-1.5 px-2 text-right w-20">ส่วนลด</th>
                  <th className="py-2.5 print:py-1.5 px-2 text-center w-12">VAT</th>
                  <th className="py-2.5 print:py-1.5 px-2 text-right w-28">มูลค่าก่อนภาษี</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {editableItems.map((item: any, i: number) => {
                  const subtotal = item.totalPrice
                  const priceBeforeDiscount = item.unitPrice
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-2.5 print:py-1 px-2 text-center text-gray-550">{i + 1}</td>
                      <td className="py-2.5 print:py-1 px-2 text-gray-900 font-medium">
                        {isEditMode ? (
                          <input
                            type="text"
                            value={item.description}
                            onChange={e => {
                              const newItems = [...editableItems]
                              newItems[i].description = e.target.value
                              setEditableItems(newItems)
                            }}
                            className="w-full bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-teal-500 rounded px-1.5 py-0.5 text-xs text-gray-900"
                          />
                        ) : (
                          <>
                            {item.description}
                            {item.partNo && item.partNo !== '-' && !/^c[a-z0-9]{24}$/i.test(item.partNo) && (
                              <span className="text-gray-400 font-mono text-[10px] block mt-0.5">({item.partNo})</span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-2.5 print:py-1 px-2 text-right text-gray-700 font-mono">
                        {isEditMode ? (
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={e => {
                              const newItems = [...editableItems]
                              const q = Number(e.target.value) || 0
                              newItems[i].quantity = q
                              newItems[i].totalPrice = q * newItems[i].unitPrice * (1 - (newItems[i].discountPct || 0) / 100)
                              setEditableItems(newItems)
                            }}
                            className="w-16 text-center bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-teal-500 rounded px-1 py-0.5 text-xs font-mono"
                          />
                        ) : (
                          Number(item.quantity).toFixed(2)
                        )}
                      </td>
                      <td className="py-2.5 print:py-1 px-2 text-right text-gray-700 font-mono">
                        {isEditMode ? (
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={e => {
                              const newItems = [...editableItems]
                              const p = Number(e.target.value) || 0
                              newItems[i].unitPrice = p
                              newItems[i].totalPrice = newItems[i].quantity * p * (1 - (newItems[i].discountPct || 0) / 100)
                              setEditableItems(newItems)
                            }}
                            className="w-24 text-right bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-teal-500 rounded px-1 py-0.5 text-xs font-mono"
                          />
                        ) : (
                          formatCurrency(priceBeforeDiscount)
                        )}
                      </td>
                      <td className="py-2.5 print:py-1 px-2 text-right text-gray-700 font-mono">
                        {isEditMode ? (
                          <input
                            type="number"
                            value={item.discountPct}
                            onChange={e => {
                              const newItems = [...editableItems]
                              const d = Number(e.target.value) || 0
                              newItems[i].discountPct = d
                              newItems[i].totalPrice = newItems[i].quantity * newItems[i].unitPrice * (1 - d / 100)
                              setEditableItems(newItems)
                            }}
                            className="w-16 text-center bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-teal-500 rounded px-1 py-0.5 text-xs font-mono"
                          />
                        ) : (
                          item.discountPct > 0 ? `${Number(item.discountPct).toFixed(2)}%` : '-'
                        )}
                      </td>
                      <td className="py-2.5 print:py-1 px-2 text-center text-gray-700">7%</td>
                      <td className="py-2.5 print:py-1 px-2 text-right text-gray-900 font-mono font-medium">{formatCurrency(subtotal)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals & Summary Block */}
          <div className="grid grid-cols-[1fr_320px] gap-8 mb-8 print:mb-4 text-xs z-10 relative print-no-break">
            {/* Left Side: Baht Text & Notes */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-t pt-3">
                <span className="font-bold text-gray-750">จำนวนเงินทั้งสิ้น (ตัวอักษร):</span>
                <span className="font-semibold text-teal-800 italic">({bahtText(grandTotal)})</span>
              </div>
              {isEditMode ? (
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                  <span className="font-bold text-gray-750 block mb-1">หมายเหตุ:</span>
                  <textarea
                    value={editableNote}
                    onChange={e => setEditableNote(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:ring-1 focus:ring-teal-500 rounded p-2 text-xs text-gray-700 font-medium leading-relaxed"
                    rows={2}
                  />
                </div>
              ) : (
                editableNote && (
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <span className="font-bold text-gray-750 block mb-1">หมายเหตุ:</span>
                    <p className="text-gray-600 whitespace-pre-wrap">{editableNote}</p>
                  </div>
                )
              )}
            </div>

            {/* Right Side: Totals */}
            <div className="bg-teal-50/40 border border-teal-100/70 rounded-xl p-4 space-y-2 font-medium">
              <div className="flex justify-between text-gray-600">
                <span>มูลค่าไม่มีหรือยกเว้นภาษี:</span>
                <span className="font-mono text-gray-900">0.00</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>มูลค่าที่คำนวณภาษี 7%:</span>
                <span className="font-mono text-gray-900">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>ภาษีมูลค่าเพิ่ม 7%:</span>
                <span className="font-mono text-gray-900">{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between text-teal-900 font-bold border-t border-teal-100 pt-2">
                <span>จำนวนเงินทั้งสิ้น:</span>
                <span className="font-mono text-base">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-[10px] border-t border-dashed pt-1.5">
                <span>จำนวนเงินถูกหัก ณ ที่จ่าย:</span>
                <span className="font-mono">0.00</span>
              </div>
              <div className="flex justify-between text-teal-900 font-bold border-t border-teal-200 pt-2 text-sm">
                <span>จำนวนเงินที่ชำระ:</span>
                <span className="font-mono text-base">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Warning Remark */}
          <div className="border border-rose-100 rounded-xl p-3 bg-rose-50/30 text-xs text-rose-600 font-semibold mb-8 print:mb-4 z-10 relative">
            {isDeliveryTax || isInvoice
              ? '* กรุณาตรวจสอบสินค้าที่ได้รับหากพ้นกำหนด 7 วันนับจากวันที่ส่งสินค้า ทางร้านจะไม่รับเปลี่ยนหรือคืน'
              : '* การชำระจะเสร็จสมบูรณ์ต่อเมื่อบริษัทฯได้รับชำระเงินเรียบร้อยแล้ว'}
          </div>

          {/* Signatures Footer */}
          <div className="grid grid-cols-3 gap-4 text-center text-xs z-10 relative print-no-break mt-4">
            <div>
              <div className="border-b border-gray-400 w-36 mx-auto mb-2 mt-4 print:mt-2"></div>
              <p className="font-bold text-gray-800">ผู้รับสินค้า</p>
              <p className="text-gray-500 text-[10px] mt-1">วันที่ ____/____/____</p>
            </div>
            <div>
              <div className="border-b border-gray-400 w-36 mx-auto mb-2 mt-4 print:mt-2"></div>
              <p className="font-bold text-gray-800">ผู้รับเงิน</p>
              <p className="text-gray-500 text-[10px] mt-1">วันที่ ____/____/____</p>
            </div>
            <div>
              <div className="border-b border-gray-400 w-36 mx-auto mb-2 mt-4 print:mt-2"></div>
              <p className="font-bold text-gray-800">ผู้ออกเอกสาร</p>
              <p className="text-gray-500 text-[10px] mt-1">วันที่ ____/____/____</p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="bg-white min-h-screen text-black">
        {/* CSS for watermark and font */}
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap');
          .font-sans {
            font-family: 'Sarabun', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }
          @media print {
            .print-no-break {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            .page-break {
              clear: both;
              page-break-after: always;
              break-after: always;
            }
          }
        `}</style>

        {/* Edit Toolbar for screen only */}
        <div className="print:hidden bg-slate-100 p-4 mb-4 rounded-xl flex items-center justify-between border border-slate-200 max-w-4xl mx-auto mt-4">
          <div className="flex items-center gap-6">
            <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
              📄 โหมดพิมพ์เอกสาร ({mainTitle})
            </span>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isEditMode}
                onChange={e => setIsEditMode(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
              />
              <span className="font-semibold text-slate-700">เปิดโหมดแก้ไขราคาก่อนพิมพ์ (ราคาขาย)</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition" onClick={() => window.print()}>
              🖨️ สั่งพิมพ์เอกสาร
            </button>
          </div>
        </div>

        {/* Page 1: Original */}
        {renderSingleSheet(false)}

        {/* Page Break for print */}
        <div className="page-break" />

        {/* Page 2: Copy */}
        {renderSingleSheet(true)}
      </div>
    )
  }

  return <div className="p-8 text-center">ไม่พบประเภทเอกสารที่ระบุ</div>
}
