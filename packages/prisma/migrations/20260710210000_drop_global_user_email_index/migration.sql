-- Legacy global unique index on email (from init migration) blocks same email across organizations.
DROP INDEX IF EXISTS "users_email_key";
