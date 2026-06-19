-- AlterTable
ALTER TABLE "DebateHistory" ADD COLUMN     "consistency" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'student';

-- CreateTable
CREATE TABLE "TeacherSettings" (
    "user_id" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "vocab" BOOLEAN NOT NULL DEFAULT true,
    "evidence_limit" BOOLEAN NOT NULL DEFAULT true,
    "rebuttal_limit" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TeacherSettings_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "TeacherSettings" ADD CONSTRAINT "TeacherSettings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
