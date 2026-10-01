-- CreateTable
CREATE TABLE "password_reset_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streak_reminder_settings" (
    "student_id" UUID NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_sent_date" DATE,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streak_reminder_settings_pkey" PRIMARY KEY ("student_id")
);

-- CreateIndex
CREATE INDEX "password_reset_codes_user_id_idx" ON "password_reset_codes"("user_id");

-- AddForeignKey
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_reminder_settings" ADD CONSTRAINT "streak_reminder_settings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep both tables out of Supabase's public Data API. The backend connects as the table
-- owner, which bypasses RLS, so the app itself is unaffected.
ALTER TABLE "password_reset_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "streak_reminder_settings" ENABLE ROW LEVEL SECURITY;
