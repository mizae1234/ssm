import prisma from '@/lib/prisma'

export async function syncInsuranceInvoice(invoiceId: string, customPrisma?: any) {
  const db = customPrisma || prisma
  const inv = await db.insuranceInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      claims: {
        include: {
          parts: true,
          labors: true,
          expenses: true
        }
      }
    }
  })

  if (!inv || !inv.claims || inv.claims.length === 0) {
    return null
  }

  let partsTotal = 0
  let laborTotal = 0
  let expensesTotal = 0

  for (const c of inv.claims) {
    const claimParts = (c.parts || []).reduce((s: number, p: any) => s + (p.priceApprove || 0) * (p.quantity || 1), 0)
    const claimLabors = (c.labors || []).reduce((s: number, l: any) => s + (l.priceApprove || 0), 0)
    const claimExpenses = (c.expenses || []).filter((e: any) => {
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
    }).reduce((s: number, e: any) => s + (e.amount || 0), 0)

    partsTotal += claimParts
    laborTotal += claimLabors
    expensesTotal += claimExpenses
  }

  const parts = Math.round(partsTotal * 100) / 100
  const labor = Math.round(laborTotal * 100) / 100
  const subtotal = Math.round((parts + labor + expensesTotal) * 100) / 100
  const vatAmount = Math.round(subtotal * 0.07 * 100) / 100
  const grandTotal = Math.round((subtotal + vatAmount) * 100) / 100

  const updated = await db.insuranceInvoice.update({
    where: { id: invoiceId },
    data: {
      partsTotal: parts,
      laborTotal: labor,
      subtotal,
      vatAmount,
      grandTotal
    }
  })

  return updated
}
