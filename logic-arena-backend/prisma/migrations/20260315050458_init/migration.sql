-- CreateTable
CREATE TABLE "User" (
    "user_id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT,
    "login_id" TEXT,
    "password" TEXT,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "profile_image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "UserStats" (
    "user_id" INTEGER NOT NULL,
    "tier" TEXT NOT NULL DEFAULT '브론즈 5',
    "rank_point" INTEGER NOT NULL DEFAULT 0,
    "score_average" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_games" INTEGER NOT NULL DEFAULT 0,
    "win_count" INTEGER NOT NULL DEFAULT 0,
    "badges" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStats_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_id_key" ON "User"("login_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "UserStats" ADD CONSTRAINT "UserStats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
