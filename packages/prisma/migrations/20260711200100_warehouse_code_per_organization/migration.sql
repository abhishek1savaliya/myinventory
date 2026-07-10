-- Legacy global unique index blocks same warehouse code across organizations.
DROP INDEX IF EXISTS "warehouses_code_key";
