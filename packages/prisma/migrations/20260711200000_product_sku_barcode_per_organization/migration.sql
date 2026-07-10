-- Legacy global unique indexes block same SKU/barcode across organizations.
DROP INDEX IF EXISTS "products_sku_key";
DROP INDEX IF EXISTS "products_barcode_key";
