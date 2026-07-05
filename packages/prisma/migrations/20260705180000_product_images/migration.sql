-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing single image_url into product_images
INSERT INTO "product_images" ("id", "product_id", "url", "sort_order", "created_at")
SELECT
    'migrated_' || "id",
    "id",
    "image_url",
    0,
    NOW()
FROM "products"
WHERE "image_url" IS NOT NULL;
