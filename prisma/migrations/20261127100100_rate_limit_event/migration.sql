-- CreateTable
CREATE TABLE "RateLimitEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "RateLimitEvent_bucket_key_at_idx" ON "RateLimitEvent"("bucket", "key", "at");
