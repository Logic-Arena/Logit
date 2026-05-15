-- CreateTable
CREATE TABLE "DebateHistory" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "logic" INTEGER NOT NULL DEFAULT 0,
    "evidence" INTEGER NOT NULL DEFAULT 0,
    "persuasion" INTEGER NOT NULL DEFAULT 0,
    "rebuttal" INTEGER NOT NULL DEFAULT 0,
    "advice" TEXT,
    "result" TEXT NOT NULL DEFAULT 'draw',
    "played_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebateHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DebateHistory" ADD CONSTRAINT "DebateHistory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
