-- ============================================================
-- Baseline: prisma-ms-docs -> schema "jobs"
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "jobs";

-- Enums
DO $$ BEGIN
  CREATE TYPE "jobs"."JobStatus" AS ENUM ('pending', 'processing', 'done', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "jobs"."JobInputSource" AS ENUM ('uploaded_file', 'json_form');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Table: jobs.jobs
CREATE TABLE IF NOT EXISTS "jobs"."jobs" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "jobs"."JobStatus" NOT NULL DEFAULT 'pending',
    "input_source" "jobs"."JobInputSource" NOT NULL,
    "prompt" TEXT NOT NULL,
    "paci_object_key" TEXT NOT NULL,
    "paci_file_name" TEXT,
    "paci_content_type" TEXT NOT NULL,
    "planning_object_key" TEXT NOT NULL,
    "planning_file_name" TEXT NOT NULL,
    "planning_content_type" TEXT NOT NULL,
    "generated_object_key" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "jobs_user_id_created_at_idx" ON "jobs"."jobs"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "jobs_status_idx" ON "jobs"."jobs"("status");
