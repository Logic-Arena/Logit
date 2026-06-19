/*
  Warnings:

  - You are about to drop the `Class` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ClassMember` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Class" DROP CONSTRAINT "Class_teacher_id_fkey";

-- DropForeignKey
ALTER TABLE "ClassMember" DROP CONSTRAINT "ClassMember_class_id_fkey";

-- DropForeignKey
ALTER TABLE "ClassMember" DROP CONSTRAINT "ClassMember_user_id_fkey";

-- DropTable
DROP TABLE "Class";

-- DropTable
DROP TABLE "ClassMember";

-- CreateTable
CREATE TABLE "DebateClass" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "class_code" TEXT NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebateClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebateClassMember" (
    "class_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebateClassMember_pkey" PRIMARY KEY ("class_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DebateClass_class_code_key" ON "DebateClass"("class_code");

-- AddForeignKey
ALTER TABLE "DebateClass" ADD CONSTRAINT "DebateClass_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebateClassMember" ADD CONSTRAINT "DebateClassMember_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "DebateClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebateClassMember" ADD CONSTRAINT "DebateClassMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
