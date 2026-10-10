-- Store private value bill review records imported from ignored JSON snapshots.
CREATE TABLE "ValueBillReview" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "attachmentNumber" INTEGER NOT NULL,
    "attachmentLabel" TEXT NOT NULL,
    "sourceFileName" TEXT,
    "sourceSha256" TEXT,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "problemRecordCount" INTEGER NOT NULL DEFAULT 0,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValueBillReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ValueBillReviewRecord" (
    "id" SERIAL NOT NULL,
    "reviewId" INTEGER NOT NULL,
    "recordId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "issueId" TEXT,
    "boqCode" TEXT,
    "boqNameZh" TEXT,
    "boqNameFr" TEXT,
    "unit" TEXT,
    "roadSlug" TEXT,
    "roadZh" TEXT,
    "roadRaw" TEXT,
    "sideCode" TEXT,
    "sideZh" TEXT,
    "pkStart" TEXT,
    "pkEnd" TEXT,
    "quantity" DECIMAL(18,4),
    "formula" TEXT,
    "note" TEXT,
    "sourceExcelRow" INTEGER,
    "source" JSONB,
    "project" JSONB,
    "attachment" JSONB,
    "data" JSONB,
    "rawRecord" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValueBillReviewRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ValueBillReview_key_key" ON "ValueBillReview"("key");
CREATE UNIQUE INDEX "ValueBillReview_projectCode_attachmentNumber_key" ON "ValueBillReview"("projectCode", "attachmentNumber");
CREATE INDEX "ValueBillReview_projectCode_idx" ON "ValueBillReview"("projectCode");
CREATE INDEX "ValueBillReview_attachmentNumber_idx" ON "ValueBillReview"("attachmentNumber");
CREATE INDEX "ValueBillReview_importedAt_idx" ON "ValueBillReview"("importedAt");

CREATE UNIQUE INDEX "ValueBillReviewRecord_recordId_key" ON "ValueBillReviewRecord"("recordId");
CREATE INDEX "ValueBillReviewRecord_reviewId_status_idx" ON "ValueBillReviewRecord"("reviewId", "status");
CREATE INDEX "ValueBillReviewRecord_reviewId_boqCode_idx" ON "ValueBillReviewRecord"("reviewId", "boqCode");
CREATE INDEX "ValueBillReviewRecord_reviewId_roadSlug_idx" ON "ValueBillReviewRecord"("reviewId", "roadSlug");
CREATE INDEX "ValueBillReviewRecord_reviewId_sideCode_idx" ON "ValueBillReviewRecord"("reviewId", "sideCode");
CREATE INDEX "ValueBillReviewRecord_reviewId_sourceExcelRow_idx" ON "ValueBillReviewRecord"("reviewId", "sourceExcelRow");
CREATE INDEX "ValueBillReviewRecord_status_idx" ON "ValueBillReviewRecord"("status");

ALTER TABLE "ValueBillReviewRecord"
ADD CONSTRAINT "ValueBillReviewRecord_reviewId_fkey"
FOREIGN KEY ("reviewId") REFERENCES "ValueBillReview"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
