-- Allow the same email in different organizations (drop legacy global unique on users.email)
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";

-- Ensure per-organization email uniqueness (idempotent if already created)
CREATE UNIQUE INDEX IF NOT EXISTS "users_organization_id_email_key" ON "users"("organization_id", "email");
