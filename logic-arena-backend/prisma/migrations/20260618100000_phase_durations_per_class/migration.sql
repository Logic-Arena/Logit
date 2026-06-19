-- AlterTable: replace short_game_mode with phase_durations JSON
ALTER TABLE "TeacherSettings" DROP COLUMN IF EXISTS "short_game_mode";
ALTER TABLE "TeacherSettings" ADD COLUMN "phase_durations" JSONB;

-- AlterTable: add per-class settings JSON to DebateClass
ALTER TABLE "DebateClass" ADD COLUMN "settings" JSONB;
