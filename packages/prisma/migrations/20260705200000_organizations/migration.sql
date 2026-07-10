-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "org_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trading_name" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contact_number" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- Default organization for existing data
INSERT INTO "organizations" ("id", "org_code", "name", "trading_name", "owner_name", "email", "contact_number", "slug", "created_at")
VALUES ('org_default_seed', 'DEM10001', 'MyInventory Demo', 'MyInventory Demo', 'System Administrator', 'admin@inventoryos.local', '', 'demo', CURRENT_TIMESTAMP);

-- Add organization_id columns (nullable first)
ALTER TABLE "users" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "products" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "warehouses" ADD COLUMN "organization_id" TEXT;

-- Backfill
UPDATE "users" SET "organization_id" = 'org_default_seed' WHERE "organization_id" IS NULL;
UPDATE "products" SET "organization_id" = 'org_default_seed' WHERE "organization_id" IS NULL;
UPDATE "warehouses" SET "organization_id" = 'org_default_seed' WHERE "organization_id" IS NULL;

-- Make NOT NULL
ALTER TABLE "users" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "warehouses" ALTER COLUMN "organization_id" SET NOT NULL;

-- Drop old unique constraints
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_sku_key";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_barcode_key";
ALTER TABLE "warehouses" DROP CONSTRAINT IF EXISTS "warehouses_code_key";

-- Add foreign keys
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- New composite uniques
CREATE UNIQUE INDEX "users_organization_id_email_key" ON "users"("organization_id", "email");
CREATE UNIQUE INDEX "products_organization_id_sku_key" ON "products"("organization_id", "sku");
CREATE UNIQUE INDEX "products_organization_id_barcode_key" ON "products"("organization_id", "barcode");
CREATE UNIQUE INDEX "warehouses_organization_id_code_key" ON "warehouses"("organization_id", "code");

-- Organization indexes
CREATE UNIQUE INDEX "organizations_org_code_key" ON "organizations"("org_code");
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX "organizations_org_code_idx" ON "organizations"("org_code");
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- Entity org indexes
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");
CREATE INDEX "products_organization_id_idx" ON "products"("organization_id");
CREATE INDEX "warehouses_organization_id_idx" ON "warehouses"("organization_id");
