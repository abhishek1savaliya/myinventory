-- Add PICKER role
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PICKER';

-- App features enum
CREATE TYPE "AppFeature" AS ENUM (
  'DASHBOARD',
  'SCAN',
  'PRODUCTS',
  'INVENTORY',
  'RECEIVING',
  'PICKING',
  'MOVEMENT',
  'WAREHOUSES',
  'LOCATIONS',
  'TRANSACTIONS',
  'USERS',
  'SETTINGS'
);

-- Per-user extra features (beyond role defaults)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "extra_features" "AppFeature"[] NOT NULL DEFAULT ARRAY[]::"AppFeature"[];
