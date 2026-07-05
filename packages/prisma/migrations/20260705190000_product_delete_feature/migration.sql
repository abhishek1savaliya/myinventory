-- Add delete-products permission to app features enum
ALTER TYPE "AppFeature" ADD VALUE IF NOT EXISTS 'PRODUCT_DELETE';
