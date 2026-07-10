ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "chat_messages_recipient_id_delivered_at_idx" ON "chat_messages"("recipient_id", "delivered_at");
