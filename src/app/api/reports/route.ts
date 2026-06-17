import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const insuranceId = searchParams.get('insuranceId') || undefined
    const vendorId = searchParams.get('vendorId') || undefined

    // Date range filter — defaults to last 3 months if not provided
    const now = new Date()
    const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : defaultFrom
    const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')! + 'T23:59:59') : now

    // Base filter for claims — always exclude CANCELLED
    const claimFilter: any = {
      createdAt: { gte: dateFrom, lte: dateTo },
      status: { not: 'CANCELLED' }
    }
    if (insuranceId) claimFilter.insuranceId = insuranceId

    // Prepare SQL filters for raw queries
    const sqlInsuranceFilter = insuranceId ? Prisma.sql`AND c."insuranceId" = ${insuranceId}` : Prisma.empty

    // 1. P&L by Month using Raw SQL Aggregation (PostgreSQL)
    const pnlRaw = await prisma.$queryRaw<any[]>`
      SELECT 
        months.month_key,
        COALESCE(claims.claims_count, 0)::int as claims,
        COALESCE(ar.ar_total, 0)::float as ar,
        COALESCE(ap_si.ap_parts, 0)::float + COALESCE(ap_gi.ap_labor, 0)::float as ap
      FROM (
        SELECT DISTINCT TO_CHAR("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM') as month_key
        FROM "Claim"
        WHERE "createdAt" >= ${dateFrom} AND "createdAt" <= ${dateTo}
      ) months
      LEFT JOIN (
        SELECT TO_CHAR(c."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM') as month_key, COUNT(*)::int as claims_count
        FROM "Claim" c
        WHERE c."status" != 'CANCELLED' AND c."createdAt" >= ${dateFrom} AND c."createdAt" <= ${dateTo}
          ${sqlInsuranceFilter}
        GROUP BY month_key
      ) claims ON claims.month_key = months.month_key
      LEFT JOIN (
        SELECT TO_CHAR(c."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM') as month_key, SUM(ii."grandTotal")::float as ar_total
        FROM "Claim" c
        JOIN "InsuranceInvoice" ii ON c."insuranceInvoiceId" = ii.id
        WHERE c."status" != 'CANCELLED' AND c."createdAt" >= ${dateFrom} AND c."createdAt" <= ${dateTo}
          ${sqlInsuranceFilter}
        GROUP BY month_key
      ) ar ON ar.month_key = months.month_key
      LEFT JOIN (
        SELECT TO_CHAR(c."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM') as month_key, SUM(si."totalAmount")::float as ap_parts
        FROM "Claim" c
        JOIN "SupplierInvoice" si ON si."claimId" = c.id
        WHERE c."status" != 'CANCELLED' AND c."createdAt" >= ${dateFrom} AND c."createdAt" <= ${dateTo}
          ${sqlInsuranceFilter}
        GROUP BY month_key
      ) ap_si ON ap_si.month_key = months.month_key
      LEFT JOIN (
        SELECT TO_CHAR(c."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM') as month_key, SUM(gi."totalAmount")::float as ap_labor
        FROM "Claim" c
        JOIN "GarageInvoice" gi ON gi."claimId" = c.id
        WHERE c."status" != 'CANCELLED' AND c."createdAt" >= ${dateFrom} AND c."createdAt" <= ${dateTo}
          ${sqlInsuranceFilter}
        GROUP BY month_key
      ) ap_gi ON ap_gi.month_key = months.month_key
      ORDER BY months.month_key ASC;
    `

    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const pnlByMonth = pnlRaw.map(row => {
      const [yearStr, monthStr] = row.month_key.split('-')
      const year = parseInt(yearStr, 10)
      const monthIdx = parseInt(monthStr, 10) - 1
      const ar = row.ar || 0
      const ap = row.ap || 0
      const profit = ar - ap
      const margin = ar > 0 ? (profit / ar) * 100 : 0
      return {
        month: `${monthNames[monthIdx]} ${year + 543}`,
        claims: row.claims || 0,
        ar,
        ap,
        profit,
        margin
      }
    })

    if (pnlByMonth.length === 0) {
      pnlByMonth.push({ month: `${monthNames[new Date().getMonth()]} ${new Date().getFullYear() + 543}`, ar: 0, ap: 0, profit: 0, margin: 0, claims: 0 })
    }

    // 2. AR Aging — Detailed list of unpaid invoices (with optimized select)
    const arInvoices = await prisma.insuranceInvoice.findMany({
      where: {
        status: { in: ['PENDING', 'SENT'] },
        claims: { some: claimFilter }
      },
      select: {
        invoiceNo: true,
        invoiceDate: true,
        grandTotal: true,
        claims: {
          select: {
            insuranceId: true,
            claimNo: true,
            carPlate: true,
            insurance: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { invoiceDate: 'asc' }
    })

    const arAging = arInvoices.map(inv => {
      const invoiceDate = new Date(inv.invoiceDate)
      const agingDays = Math.max(0, Math.floor((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)))
      const primaryClaim = inv.claims[0] || { claimNo: '', carPlate: '', insuranceId: '', insurance: { name: '' } }
      return {
        insurance: primaryClaim.insurance?.name || '',
        insuranceId: primaryClaim.insuranceId,
        claimNo: inv.claims.map(c => c.claimNo).join(', '),
        carPlate: inv.claims.map(c => c.carPlate).join(', '),
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.invoiceDate,
        amount: inv.grandTotal,
        agingDays
      }
    })

    // 3. AP Outstanding — Detailed list of unpaid vendor/garage invoices (with optimized select)
    const supplierFilter: any = {}
    if (vendorId) supplierFilter.vendorId = vendorId

    const apInvoices = await prisma.supplierInvoice.findMany({
      where: {
        ...supplierFilter,
        apPayment: null, // not yet paid
        claim: claimFilter,
      },
      select: {
        invoiceNo: true,
        createdAt: true,
        totalAmount: true,
        vendorId: true,
        vendor: {
          select: { name: true }
        },
        claim: {
          select: {
            claimNo: true,
            carPlate: true
          }
        }
      }
    })

    const garageInvoices = await prisma.garageInvoice.findMany({
      where: {
        claim: claimFilter,
      },
      select: {
        invoiceNo: true,
        createdAt: true,
        totalAmount: true,
        garageId: true,
        garage: {
          select: { name: true }
        },
        claim: {
          select: {
            claimNo: true,
            carPlate: true
          }
        }
      }
    })

    const apOutstanding = [
      ...apInvoices.map(inv => ({
        vendor: inv.vendor.name,
        vendorId: inv.vendorId,
        type: 'อะไหล่',
        invoiceNo: inv.invoiceNo || '-',
        claimNo: inv.claim.claimNo,
        carPlate: inv.claim.carPlate,
        invoiceDate: inv.createdAt,
        amount: inv.totalAmount
      })),
      ...garageInvoices.map(inv => ({
        vendor: inv.garage?.name || 'อู่ซ่อม',
        vendorId: inv.garageId || '',
        type: 'ค่าแรง',
        invoiceNo: inv.invoiceNo || '-',
        claimNo: inv.claim.claimNo,
        carPlate: inv.claim.carPlate,
        invoiceDate: inv.createdAt,
        amount: inv.totalAmount
      }))
    ].sort((a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime())

    // 4. Vendor Performance — Grouped by vendorId using SQL aggregate functions
    const poStats = await prisma.purchaseOrder.groupBy({
      by: ['vendorId'],
      where: {
        claim: claimFilter,
        status: { not: 'CANCELLED' },
        vendorId: vendorId ? vendorId : undefined,
      },
      _count: {
        id: true,
      },
      _sum: {
        totalAmount: true,
      }
    })

    const vendors = await prisma.vendor.findMany({
      where: vendorId ? { id: vendorId } : undefined,
      select: {
        id: true,
        name: true,
        vendorType: true,
        paymentTerms: true,
        zone: true,
      }
    })

    const statsMap = new Map(poStats.map(s => [s.vendorId, { count: s._count.id, total: s._sum.totalAmount || 0 }]))

    const vendorPerf = vendors.map(v => {
      const stats = statsMap.get(v.id) || { count: 0, total: 0 }
      return {
        id: v.id,
        name: v.name,
        vendorType: v.vendorType,
        poCount: stats.count,
        totalValue: stats.total,
        paymentTerms: v.paymentTerms,
        zone: v.zone,
      }
    }).filter(v => v.poCount > 0)

    // 5. Income / Expense Detail — Line-item breakdown per claim (with optimized select)
    const claimsForIE = await prisma.claim.findMany({
      where: claimFilter,
      select: {
        id: true,
        claimNo: true,
        carPlate: true,
        createdAt: true,
        insurance: {
          select: { name: true }
        },
        insuranceInvoice: {
          select: {
            grandTotal: true,
            invoiceNo: true,
            status: true
          }
        },
        supplierInvoices: {
          select: {
            totalAmount: true
          }
        },
        garageInvoices: {
          select: {
            totalAmount: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const incomeExpense = claimsForIE.map(c => {
      const arTotal = c.insuranceInvoice?.grandTotal || 0
      const apParts = c.supplierInvoices.reduce((s, inv) => s + inv.totalAmount, 0)
      const apLabor = c.garageInvoices.reduce((s, inv) => s + inv.totalAmount, 0)
      const apTotal = apParts + apLabor
      return {
        claimId: c.id,
        claimNo: c.claimNo,
        insurance: c.insurance?.name || '-',
        carPlate: c.carPlate || '-',
        date: c.createdAt,
        arTotal,
        apParts,
        apLabor,
        apTotal,
        profit: arTotal - apTotal,
        invoiceNo: c.insuranceInvoice?.invoiceNo || '-',
        invoiceStatus: c.insuranceInvoice?.status || 'NONE',
      }
    })

    return NextResponse.json({
      pnlByMonth,
      arAging,
      apOutstanding,
      vendorPerf,
      incomeExpense,
    })
  } catch (error) {
    console.error('[API] GET /api/reports error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
