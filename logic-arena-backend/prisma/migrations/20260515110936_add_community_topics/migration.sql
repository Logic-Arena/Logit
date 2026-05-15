-- CreateTable
CREATE TABLE "CommunityTopic" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "badge" TEXT,
    "pro_votes" INTEGER NOT NULL DEFAULT 0,
    "con_votes" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityVote" (
    "id" SERIAL NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "vote" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityVote_topic_id_user_id_key" ON "CommunityVote"("topic_id", "user_id");

-- AddForeignKey
ALTER TABLE "CommunityVote" ADD CONSTRAINT "CommunityVote_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "CommunityTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
