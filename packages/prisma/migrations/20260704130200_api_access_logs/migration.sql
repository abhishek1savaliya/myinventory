-- CreateTable
CREATE TABLE IF NOT EXISTS "api_access_logs" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "user_id" TEXT,
    "user_email" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "api_access_logs_created_at_idx" ON "api_access_logs"("created_at");
CREATE INDEX IF NOT EXISTS "api_access_logs_user_id_idx" ON "api_access_logs"("user_id");
CREATE INDEX IF NOT EXISTS "api_access_logs_path_idx" ON "api_access_logs"("path");
CREATE INDEX IF NOT EXISTS "api_access_logs_status_code_idx" ON "api_access_logs"("status_code");
CREATE INDEX IF NOT EXISTS "api_access_logs_method_idx" ON "api_access_logs"("method");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "api_access_logs" ADD CONSTRAINT "api_access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
