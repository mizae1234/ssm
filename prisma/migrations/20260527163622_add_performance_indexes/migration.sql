-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE INDEX "Claim_createdAt_idx" ON "Claim"("createdAt");

-- CreateIndex
CREATE INDEX "Claim_insuranceId_idx" ON "Claim"("insuranceId");

-- CreateIndex
CREATE INDEX "ClaimExpense_isSynced_idx" ON "ClaimExpense"("isSynced");

-- CreateIndex
CREATE INDEX "ClaimExpense_claimId_idx" ON "ClaimExpense"("claimId");

-- CreateIndex
CREATE INDEX "InsuranceInvoice_status_idx" ON "InsuranceInvoice"("status");

-- CreateIndex
CREATE INDEX "InsuranceInvoice_createdAt_idx" ON "InsuranceInvoice"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentRequest_status_idx" ON "PaymentRequest"("status");

-- CreateIndex
CREATE INDEX "PaymentRequest_createdAt_idx" ON "PaymentRequest"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentRequest_claimId_idx" ON "PaymentRequest"("claimId");

-- CreateIndex
CREATE INDEX "SupplierInvoice_isSynced_idx" ON "SupplierInvoice"("isSynced");

-- CreateIndex
CREATE INDEX "SupplierInvoice_claimId_idx" ON "SupplierInvoice"("claimId");
