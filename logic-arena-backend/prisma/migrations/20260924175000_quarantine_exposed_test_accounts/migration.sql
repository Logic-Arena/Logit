-- The original security report disclosed credentials for these two local test
-- accounts. Disable password login while preserving every activity/class row.
-- STUDENTTEST01-12 and TEACHERTEST are separate QA accounts and are untouched.
UPDATE "User"
SET "password" = NULL
WHERE "provider" = 'local'
  AND "login_id" IN ('test01', 'testuser')
  AND "password" IS NOT NULL;
