import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'

export const maxDuration = 120 // 2 minutes for 2-pass extraction
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// Helper: call Claude with an image and a prompt, return parsed JSON
async function callClaude(
  imageContent: any,
  systemPrompt: string,
  userText: string
): Promise<any> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: 'user', content: [imageContent, { type: 'text', text: userText }] }],
  })

  const textBlock = response.content.find((b: any) => b.type === 'text') as any
  if (!textBlock?.text) {
    throw new Error(`No text in Claude response. stop_reason=${response.stop_reason}`)
  }

  const raw = textBlock.text
  console.log(`[extract-claim] stop_reason=${response.stop_reason}, chars=${raw.length}, preview=${raw.substring(0, 150)}`)
  
  // Save raw response for debugging
  try {
    fs.appendFileSync('/tmp/expert-ai-debug.txt', `\n\n--- NEW API CALL ---\nPrompt: ${userText}\nResponse:\n${raw}\n`)
  } catch(e) {}

  // Try parse strategies
  // 1. Direct
  try { return JSON.parse(raw.trim()) } catch (_) {}
  // 2. Strip ```json fences
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) { try { return JSON.parse(fence[1].trim()) } catch (_) {} }
  // 3. Extract outermost { }
  const first = raw.indexOf('{'), last = raw.lastIndexOf('}')
  if (first !== -1 && last > first) {
    try { return JSON.parse(raw.substring(first, last + 1)) } catch (_) {}
  }
  // 4. Extract outermost [ ]
  const firstArr = raw.indexOf('['), lastArr = raw.lastIndexOf(']')
  if (firstArr !== -1 && lastArr > firstArr) {
    try { return JSON.parse(raw.substring(firstArr, lastArr + 1)) } catch (_) {}
  }

  throw new Error('AI response was not valid JSON. Preview: ' + raw.substring(0, 300))
}

// Helper: call Claude with MULTIPLE images and a prompt, return parsed JSON
async function callClaudeMulti(
  imageContents: any[],
  systemPrompt: string,
  userText: string
): Promise<any> {
  const content = [...imageContents, { type: 'text', text: userText }]
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
  })

  const textBlock = response.content.find((b: any) => b.type === 'text') as any
  if (!textBlock?.text) {
    throw new Error(`No text in Claude response. stop_reason=${response.stop_reason}`)
  }

  const raw = textBlock.text
  console.log(`[extract-claim-multi] stop_reason=${response.stop_reason}, chars=${raw.length}, preview=${raw.substring(0, 150)}`)
  
  try {
    fs.appendFileSync('/tmp/expert-ai-debug.txt', `\n\n--- NEW MULTI-IMAGE API CALL ---\nImages: ${imageContents.length}\nPrompt: ${userText}\nResponse:\n${raw}\n`)
  } catch(e) {}

  // Try parse strategies
  try { return JSON.parse(raw.trim()) } catch (_) {}
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) { try { return JSON.parse(fence[1].trim()) } catch (_) {} }
  const first = raw.indexOf('{'), last = raw.lastIndexOf('}')
  if (first !== -1 && last > first) {
    try { return JSON.parse(raw.substring(first, last + 1)) } catch (_) {}
  }
  const firstArr = raw.indexOf('['), lastArr = raw.lastIndexOf(']')
  if (firstArr !== -1 && lastArr > firstArr) {
    try { return JSON.parse(raw.substring(firstArr, lastArr + 1)) } catch (_) {}
  }

  throw new Error('AI response was not valid JSON. Preview: ' + raw.substring(0, 300))
}

function buildImageBlock(fileData: string, mimeType: string) {
  const base64Data = fileData.split(',')[1]
  if (!base64Data) throw new Error('Invalid file format')

  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf' = 'image/jpeg'
  if (mimeType === 'application/pdf' || fileData.startsWith('data:application/pdf')) mediaType = 'application/pdf'
  else if (mimeType === 'image/png' || fileData.startsWith('data:image/png')) mediaType = 'image/png'
  else if (mimeType === 'image/webp' || fileData.startsWith('data:image/webp')) mediaType = 'image/webp'
  else if (mimeType === 'image/gif') mediaType = 'image/gif'

  const isPDF = mediaType === 'application/pdf'
  return isPDF
    ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64Data } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Support both single file (legacy) and multiple files
    let fileEntries: { file: string; mimeType: string }[] = []
    
    if (body.files && Array.isArray(body.files)) {
      // New multi-file format: { files: [{ file, mimeType }, ...] }
      fileEntries = body.files
    } else if (body.file) {
      // Legacy single-file format: { file, mimeType }
      fileEntries = [{ file: body.file, mimeType: body.mimeType }]
    } else {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (fileEntries.length === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'API key missing' }, { status: 500 })
    }

    // Build image blocks for all files
    const imageBlocks = fileEntries.map(({ file, mimeType }) => {
      const base64Data = file.split(',')[1]
      const sizeMB = base64Data ? (base64Data.length * 0.75 / 1024 / 1024).toFixed(2) : '0'
      console.log(`[extract-claim] mimeType=${mimeType}, size~${sizeMB}MB`)
      return buildImageBlock(file, mimeType)
    })

    const isMultiImage = imageBlocks.length > 1
    console.log(`[extract-claim] Processing ${imageBlocks.length} image(s), multi=${isMultiImage}`)

    // ─── PASS 1: Extract claim metadata, car info, and summary totals ───────────
    const systemPass1 = `You are an expert at extracting data from Thai vehicle insurance claim documents.
The document is EITHER:
  (A) A screenshot from the eGarage insurance system — shows a left sidebar with claim info fields and two tables.
  (B) A standard paper/PDF claim estimate form.

For Type A (eGarage), look at the top header area or sidebars, which contains:
  - "เลขที่-Claim" or "Claim:" or "เลขที่ E-Claim" = claimNo
  - "เลขที่ E-Part" or "E-Part:" or "เลขที่ e-part" or "เลข E-Part" = ePartNo (If there are multiple e-part numbers/jobs mentioned, join them with commas, e.g. "P052605335000, P052605335001")
  - "เลขรับแจ้ง" or "เลขที่รับแจ้ง" = receiveNo
  - "เลขที่เคลม" = transactionNo
  - "ชื่อบริษัท" or "บริษัทประกัน" or "บริษัท" = insuranceName
  - "สาขา" = branch
  - "ทะเบียน" or "ทะเบียนรถ" = car.plate
  - "จังหวัด" = car.province
  - "ยี่ห้อ" = car.brand
  - "รุ่น" = car.model
  - "หมายเลขตัวถัง" or "เลขตัวถัง" = car.vin
  - "สีรถ" or "สี" = car.color
  - "วันที่สร้าง" = createdAt
  - "วันที่ส่ง" = sentAt
  - "ชื่อผู้เอาประกัน" or "ผู้เอาประกัน" = car.insuredName
  Summary totals: look for "รวม" rows in tables, use "ราคาอนุมัติ" column value.

RULES:
- Output ONLY valid JSON, no markdown, no explanation.
- Numbers: strip commas (7,399.25 -> 7399.25). Missing = 0 or "".
- confidence: 90-100=clear, 70-89=readable, 50-69=guessed, 0-49=missing.`

    const systemPass2 = `You are an expert at extracting tabular data from Thai vehicle insurance claim documents.
The document is EITHER:
  (A) eGarage screenshot — has two tables: "รายการค่าแรง" (labor) and "รายการค่าอะไหล่" (parts).
  (B) Standard paper/PDF claim form.

For eGarage (Type A):
LABOR TABLE columns: #, Group, รายการ, เส้นหาย, %, ระดับเสียหาย+ราคาเสนอ, ระดับเสียหาย+ราคาอนุมัติ, รูป, ครั้งที่, สถานะ, EV
  - description = "รายการ" column text
  - damageLevel = text inside () in ระดับเสียหาย
  - priceOffer = ราคาเสนอ amount
  - priceApprove = ราคาอนุมัติ amount
  - discountPct = % column
  - SKIP rows labeled "ส่วนลด/ส่วนเพิ่ม", "คงเหลือ", "รวม"

PARTS TABLE — split into sections (e.g., "ศูนย์/ผู้ซ่อม", "ร้านอะไหล่", "บริษัทประกัน"):
  - partNo = หมายเลขอะไหล่
  - partName = รายการ
  - priceFull = ราคาเดิม
  - quantity = จำนวน
  - damageType = ประเภท under "ร้านอะไหล่" section (if exists, extract from "ประเภท" under "ร้านอะไหล่" column; otherwise fallback to "ประเภท" under "ศูนย์/ผู้ซ่อม")
  - priceOffer = ราคาเสนอ under ศูนย์
  - priceApprove = ราคาอนุมัติ under บริษัทประกัน
  - discountPct = % under บริษัทประกัน
  - requireReturn = true if row has red "คืนซาก" tag
  - If "สถานะ" column says "ไม่อนุมัติ", set priceApprove = 0

RULES:
- Output ONLY valid JSON array pairs, no markdown.
- Extract ALL rows. To save space, do NOT use "value" and "confidence" wrappers. Use flat keys.
- Numbers: strip commas. Missing = 0.`

    const pass2UserPrompt = `Extract ALL labor rows and ALL parts rows from this document.
Output this exact flat JSON structure:
{
  "labors": [
    {
      "description": "",
      "damageLevel": "",
      "discountPct": 0,
      "priceOffer": 0,
      "priceApprove": 0
    }
  ],
  "parts": [
    {
      "partNo": "",
      "partName": "",
      "priceFull": 0,
      "quantity": 1,
      "damageType": "",
      "discountPct": 0,
      "priceOffer": 0,
      "priceApprove": 0,
      "supplier": "ศูนย์",
      "requireReturn": false
    }
  ]
}`

    // ─── EXECUTE PASSES ──────────────────────────────────────────────────────
    let metaData: any
    let allLabors: any[] = []
    let allParts: any[] = []

    if (isMultiImage) {
      // Multi-image: Pass 1 on first image, Pass 2 on ALL images together (single call)
      const multiImagePass2Prompt = `These are ${imageBlocks.length} screenshots/images from the SAME claim document (the user scrolled and captured multiple screenshots to cover all rows).
Extract ALL labor rows and ALL parts rows from ALL images combined. Do NOT duplicate rows that appear in multiple images.
Output this exact flat JSON structure:
{
  "labors": [
    {
      "description": "",
      "damageLevel": "",
      "discountPct": 0,
      "priceOffer": 0,
      "priceApprove": 0
    }
  ],
  "parts": [
    {
      "partNo": "",
      "partName": "",
      "priceFull": 0,
      "quantity": 1,
      "damageType": "",
      "discountPct": 0,
      "priceOffer": 0,
      "priceApprove": 0,
      "supplier": "ศูนย์",
      "requireReturn": false
    }
  ]
}`

      const [meta, lineItemsFlat] = await Promise.all([
        callClaude(imageBlocks[0], systemPass1, `Extract ONLY the claim metadata, car info, and summary totals from this document.
Output this exact JSON structure:
{
  "claim": {
    "claimNo": { "value": "", "confidence": 0 },
    "ePartNo": { "value": "", "confidence": 0 },
    "receiveNo": { "value": "", "confidence": 0 },
    "transactionNo": { "value": "", "confidence": 0 },
    "insuranceName": { "value": "", "confidence": 0 },
    "branch": { "value": "", "confidence": 0 },
    "status": { "value": "RECEIVED", "confidence": 100 },
    "createdAt": { "value": "", "confidence": 0 },
    "sentAt": { "value": "", "confidence": 0 }
  },
  "car": {
    "plate": { "value": "", "confidence": 0 },
    "province": { "value": "", "confidence": 0 },
    "brand": { "value": "", "confidence": 0 },
    "model": { "value": "", "confidence": 0 },
    "vin": { "value": "", "confidence": 0 },
    "color": { "value": "", "confidence": 0 },
    "insuredName": { "value": "", "confidence": 0 }
  },
  "summary": {
    "laborTotal": { "value": 0, "confidence": 0 },
    "partsTotal": { "value": 0, "confidence": 0 },
    "subtotal": { "value": 0, "confidence": 0 },
    "vat": { "value": 0, "confidence": 0 },
    "grandTotal": { "value": 0, "confidence": 0 },
    "deductible": { "value": 0, "confidence": 0 }
  }
}`),
        callClaudeMulti(imageBlocks, systemPass2, multiImagePass2Prompt)
      ])

      metaData = meta
      allLabors = lineItemsFlat.labors || []
      allParts = lineItemsFlat.parts || []

      console.log(`[extract-claim] Multi-image merged: labors=${allLabors.length}, parts=${allParts.length}`)
    } else {
      // Single image: original behavior
      const [meta, lineItemsFlat] = await Promise.all([
        callClaude(imageBlocks[0], systemPass1, `Extract ONLY the claim metadata, car info, and summary totals from this document.
Output this exact JSON structure:
{
  "claim": {
    "claimNo": { "value": "", "confidence": 0 },
    "ePartNo": { "value": "", "confidence": 0 },
    "receiveNo": { "value": "", "confidence": 0 },
    "transactionNo": { "value": "", "confidence": 0 },
    "insuranceName": { "value": "", "confidence": 0 },
    "branch": { "value": "", "confidence": 0 },
    "status": { "value": "RECEIVED", "confidence": 100 },
    "createdAt": { "value": "", "confidence": 0 },
    "sentAt": { "value": "", "confidence": 0 }
  },
  "car": {
    "plate": { "value": "", "confidence": 0 },
    "province": { "value": "", "confidence": 0 },
    "brand": { "value": "", "confidence": 0 },
    "model": { "value": "", "confidence": 0 },
    "vin": { "value": "", "confidence": 0 },
    "color": { "value": "", "confidence": 0 },
    "insuredName": { "value": "", "confidence": 0 }
  },
  "summary": {
    "laborTotal": { "value": 0, "confidence": 0 },
    "partsTotal": { "value": 0, "confidence": 0 },
    "subtotal": { "value": 0, "confidence": 0 },
    "vat": { "value": 0, "confidence": 0 },
    "grandTotal": { "value": 0, "confidence": 0 },
    "deductible": { "value": 0, "confidence": 0 }
  }
}`),
        callClaude(imageBlocks[0], systemPass2, pass2UserPrompt)
      ])

      metaData = meta
      allLabors = lineItemsFlat.labors || []
      allParts = lineItemsFlat.parts || []
    }

    // ─── Wrap line items & build result ─────────────────────────────────
    console.log(`[extract-claim] Final labors=${allLabors.length}, parts=${allParts.length}`)
    if (!allLabors.length && !allParts.length) {
      console.warn('[extract-claim] Returned empty labors and parts.')
    }

    const wrap = (val: any) => ({ value: val, confidence: 90 })

    const laborsWrapped = allLabors.map((l: any) => ({
      description: wrap(l.description || ""),
      damageLevel: wrap(l.damageLevel || ""),
      discountPct: wrap(l.discountPct || 0),
      priceOffer: wrap(l.priceOffer || 0),
      priceApprove: wrap(l.priceApprove || 0)
    }))

    const partsWrapped = allParts.map((p: any) => ({
      partNo: wrap(p.partNo || ""),
      partName: wrap(p.partName || ""),
      priceFull: wrap(p.priceFull || 0),
      quantity: wrap(p.quantity || 1),
      damageType: wrap(p.damageType || ""),
      discountPct: wrap(p.discountPct || 0),
      priceOffer: wrap(p.priceOffer || 0),
      priceApprove: wrap(p.priceApprove || 0),
      supplier: wrap(p.supplier || ""),
      requireReturn: wrap(p.requireReturn || false)
    }))

    const warnings: string[] = []
    partsWrapped.forEach((p: any) => {
      if (p.priceApprove.value === 0 && p.priceFull.value > 0) {
        warnings.push(`อะไหล่ไม่ถูกอนุมัติ: ${p.partName.value || p.partNo.value}`)
      }
    })

    const result = {
      ...metaData,
      labors: laborsWrapped,
      parts: partsWrapped,
      validation: {
        passed: warnings.length === 0,
        warnings,
      },
    }

    return NextResponse.json(result)

  } catch (error: any) {
    const errMsg = error?.message || error?.toString() || 'Unknown error'
    const errStatus = error?.status || 500
    console.error('[extract-claim] error:', errMsg)
    return NextResponse.json({ error: 'Failed to extract document: ' + errMsg }, { status: errStatus })
  }
}
