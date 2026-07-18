-- AlterTable
ALTER TABLE "chat_messages"
  ALTER COLUMN "recipient_id" DROP NOT NULL,
  ADD COLUMN "group_id" TEXT;

-- CreateTable
CREATE TABLE "chat_groups" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "chat_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_group_members" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "can_send" BOOLEAN NOT NULL DEFAULT true,
  "last_read_at" TIMESTAMP(3),
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "chat_group_members_pkey" PRIMARY KEY ("id")
);

-- A message must target exactly one direct recipient or one group.
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_exactly_one_target_check"
  CHECK (
    ("recipient_id" IS NOT NULL AND "group_id" IS NULL)
    OR ("recipient_id" IS NULL AND "group_id" IS NOT NULL)
  );

-- CreateIndex
CREATE INDEX "chat_groups_organization_id_idx" ON "chat_groups"("organization_id");
CREATE INDEX "chat_groups_created_by_id_idx" ON "chat_groups"("created_by_id");
CREATE UNIQUE INDEX "chat_group_members_group_id_user_id_key" ON "chat_group_members"("group_id", "user_id");
CREATE INDEX "chat_group_members_user_id_idx" ON "chat_group_members"("user_id");
CREATE INDEX "chat_messages_group_id_created_at_idx" ON "chat_messages"("group_id", "created_at");

-- AddForeignKey
ALTER TABLE "chat_groups"
  ADD CONSTRAINT "chat_groups_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chat_groups"
  ADD CONSTRAINT "chat_groups_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chat_group_members"
  ADD CONSTRAINT "chat_group_members_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "chat_groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_group_members"
  ADD CONSTRAINT "chat_group_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "chat_groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
