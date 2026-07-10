-- Add chat feature and messages table
ALTER TYPE "AppFeature" ADD VALUE IF NOT EXISTS 'CHAT';

CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_messages_organization_id_idx" ON "chat_messages"("organization_id");
CREATE INDEX "chat_messages_sender_id_recipient_id_idx" ON "chat_messages"("sender_id", "recipient_id");
CREATE INDEX "chat_messages_recipient_id_read_at_idx" ON "chat_messages"("recipient_id", "read_at");
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages"("created_at");

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
