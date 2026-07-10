ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "reply_to_message_id" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "forwarded_from_id" TEXT;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "deleted_for_everyone_at" TIMESTAMP(3);
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "hidden_for_sender_at" TIMESTAMP(3);
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "hidden_for_recipient_at" TIMESTAMP(3);

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_reply_to_message_id_fkey"
  FOREIGN KEY ("reply_to_message_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_forwarded_from_id_fkey"
  FOREIGN KEY ("forwarded_from_id") REFERENCES "chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "chat_messages_reply_to_message_id_idx" ON "chat_messages"("reply_to_message_id");
