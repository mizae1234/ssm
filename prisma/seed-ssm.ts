import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed-ssm script...')

  try {
    console.log('Clearing database tables...')
    // Delete payments first
    await prisma.aPPayment.deleteMany()
    await prisma.aRPayment.deleteMany()
    await prisma.billReceipt.deleteMany()
    await prisma.paymentRequest.deleteMany()
    
    // Delete status and extraction logs
    await prisma.claimStatusLog.deleteMany()
    await prisma.extractionLog.deleteMany()
    
    // Delete claim expenses and documents
    await prisma.claimExpense.deleteMany()
    await prisma.claimDocument.deleteMany()

    // Delete quotations
    await prisma.quotationLabor.deleteMany()
    await prisma.quotationPart.deleteMany()
    await prisma.quotation.deleteMany()
    
    // Delete invoices
    await prisma.supplierInvoiceItem.deleteMany()
    await prisma.supplierInvoice.deleteMany()
    await prisma.garageInvoiceItem.deleteMany()
    await prisma.garageInvoice.deleteMany()
    await prisma.insuranceInvoice.deleteMany()

    // Delete goods receipt and PO items
    await prisma.deliveryOrder.deleteMany()
    await prisma.goodsReceiptItem.deleteMany()
    await prisma.goodsReceipt.deleteMany()
    await prisma.pOItem.deleteMany()
    await prisma.purchaseOrder.deleteMany()
    
    // Delete claim items and claims
    await prisma.claimPart.deleteMany()
    await prisma.claimLabor.deleteMany()
    await prisma.claim.deleteMany()

    // Delete parts vendor price and stock tables
    await prisma.partVendorPrice.deleteMany()
    await prisma.stockMovement.deleteMany()
    await prisma.stockBalance.deleteMany()
    await prisma.partMaster.deleteMany()

    // Delete insurances and vendors
    await prisma.insurance.deleteMany()
    await prisma.vendor.deleteMany()
    
    console.log('Database tables cleared successfully.')

    // ==========================================
    // 1. Seed Contacts (Insurance & Vendor)
    // ==========================================
    console.log('Reading template_Contact_ssm.xlsx...')
    const contactsWb = XLSX.readFile('./template_Contact_ssm.xlsx')
    const contactsSheet = contactsWb.Sheets['ผู้ติดต่อทั้งหมด']
    const contactsRows: any[] = XLSX.utils.sheet_to_json(contactsSheet, { header: 1 })

    console.log(`Found ${contactsRows.length} rows (including headers). Importing contacts...`)

    let insuranceCount = 0
    let vendorCount = 0

    // Row 0 is group header, Row 1 is column header, data starts at Row 2
    for (let i = 2; i < contactsRows.length; i++) {
      const row = contactsRows[i]
      if (!row || !row[1]) continue // skip empty code

      const code = String(row[1]).trim()
      const taxId = row[4] ? String(row[4]).trim() : null
      const branchCode = row[5] ? String(row[5]).trim() : '00000'
      const businessType = row[6] ? String(row[6]).trim() : 'บริษัทจำกัด'
      const name = row[8] ? String(row[8]).trim() : ''
      const address = row[11] ? String(row[11]).trim() : ''
      const subDistrict = row[12] ? String(row[12]).trim() : ''
      const district = row[13] ? String(row[13]).trim() : ''
      const province = row[14] ? String(row[14]).trim() : ''
      const zipCode = row[15] ? String(row[15]).trim() : ''
      const email = row[22] ? String(row[22]).trim() : null
      const phone = row[23] ? String(row[23]).trim() : null

      const fullAddress = [address, subDistrict, district, province, zipCode].filter(Boolean).join(' ')

      if (name.includes('ประกัน') || name.includes('ประกันภัย')) {
        // Create Insurance
        await prisma.insurance.create({
          data: {
            id: code,
            name: name,
            taxId: taxId,
            branchCode: branchCode,
            address: fullAddress,
            contactPerson: row[10] ? String(row[10]).trim() : null,
            peakCustomerId: code,
            businessType: businessType,
            nationality: 'ไทย',
          }
        })
        insuranceCount++
      } else {
        // Create Vendor
        // Identify garages by name keywords
        const isGarage = name.includes('คาร์แคร์') || name.includes('มีนบุรี') || name.includes('มอเตอร์ส')
        const vendorType = isGarage ? 'GARAGE' : 'PARTS'

        await prisma.vendor.create({
          data: {
            id: code,
            name: name,
            vendorType: vendorType,
            taxId: taxId,
            phone: phone,
            address: fullAddress,
            branchCode: branchCode,
            peakVendorCode: code,
            businessType: businessType,
            isActive: true,
            paymentTerms: 30
          }
        })
        vendorCount++
      }
    }

    console.log(`Imported ${insuranceCount} Insurances and ${vendorCount} Vendors.`)

    // ==========================================
    // 2. Seed Products (PartMaster & StockBalance)
    // ==========================================
    console.log('Reading template_Product_ssm.xlsx...')
    const productsWb = XLSX.readFile('./template_Product_ssm.xlsx')
    const productsSheet = productsWb.Sheets['สินค้าทั้งหมด']
    const productsRows: any[] = XLSX.utils.sheet_to_json(productsSheet, { header: 1 })

    console.log(`Found ${productsRows.length} rows (including headers). Importing products...`)

    let productCount = 0
    const insertedPartNos = new Set<string>()

    // Row 0 is group header, Row 1 is column header, data starts at Row 2
    for (let i = 2; i < productsRows.length; i++) {
      const row = productsRows[i]
      if (!row || !row[1]) continue // skip empty product code

      const partNo = String(row[1]).trim()
      const partName = String(row[2]).trim()
      const description = row[3] ? String(row[3]).trim() : null
      const unit = row[4] ? String(row[4]).trim() : 'ชิ้น'
      const purchasePrice = row[5] ? Number(row[5]) : 0
      const sellingPrice = row[7] ? Number(row[7]) : 0
      const peakCode = row[13] ? String(row[13]).trim() : null

      if (insertedPartNos.has(partNo)) {
        console.log(`Warning: Duplicate partNo skipped: ${partNo}`)
        continue
      }
      insertedPartNos.add(partNo)

      // Create PartMaster
      await prisma.partMaster.create({
        data: {
          partNo: partNo,
          partName: partName,
          unit: unit,
          standardPrice: sellingPrice,
          purchasePrice: purchasePrice,
          description: description,
          peakCode: peakCode,
          stock: 0,
          isActive: true,
          source: 'MANUAL',
          usageCount: 0
        }
      })

      // Create StockBalance
      await prisma.stockBalance.create({
        data: {
          partNo: partNo,
          partName: partName,
          quantity: 0
        }
      })

      productCount++
    }

    console.log(`Imported ${productCount} Parts and initialized their StockBalances.`)
    console.log('Seeding completed successfully!')

  } catch (error: any) {
    console.error('Seeding failed with error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
