-- AlterTable
ALTER TABLE "jobs"."jobs" ADD COLUMN IF NOT EXISTS "colegio_id" UUID;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "jobs_colegio_id_idx" ON "jobs"."jobs"("colegio_id");
