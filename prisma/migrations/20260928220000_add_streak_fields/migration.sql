-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "current_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "longest_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_streak_date" DATE;
