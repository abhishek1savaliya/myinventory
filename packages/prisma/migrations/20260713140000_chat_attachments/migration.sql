CREATE TYPE "ChatAttachmentType" AS ENUM ('IMAGE', 'VIDEO', 'FILE');

ALTER TABLE "chat_messages" ALTER COLUMN "body" SET DEFAULT '';

ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_type" "ChatAttachmentType";
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_url" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_name" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_mime_type" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_size" INTEGER;
