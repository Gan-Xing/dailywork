-- Preserve prior review datasets while permitting a distinct source workbook
-- for the same project and attachment. No records or source hashes are changed.
CREATE UNIQUE INDEX "ValueBillReview_projectCode_attachmentNumber_sourceSha256_key"
ON "ValueBillReview"("projectCode", "attachmentNumber", "sourceSha256");

DROP INDEX "ValueBillReview_projectCode_attachmentNumber_key";
