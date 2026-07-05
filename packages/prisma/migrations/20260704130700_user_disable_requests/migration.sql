-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DisableRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_disable_requests" (
    "id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "status" "DisableRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "user_disable_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_disable_requests_target_user_id_status_idx" ON "user_disable_requests"("target_user_id", "status");
CREATE INDEX IF NOT EXISTS "user_disable_requests_requested_by_id_idx" ON "user_disable_requests"("requested_by_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "user_disable_requests" ADD CONSTRAINT "user_disable_requests_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_disable_requests" ADD CONSTRAINT "user_disable_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
