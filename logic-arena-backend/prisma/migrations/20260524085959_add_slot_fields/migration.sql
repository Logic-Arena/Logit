-- AlterTable
ALTER TABLE "CommunityTopic" ADD COLUMN     "category_fixed" TEXT NOT NULL DEFAULT '사회',
ADD COLUMN     "display_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slot" TEXT NOT NULL DEFAULT 'A',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';
