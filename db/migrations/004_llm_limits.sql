-- 003 intentionally unused. Any future rollup needs a higher migration number.
-- Count every provider attempt.
CREATE TABLE llm_daily_usage (
 user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day date NOT NULL,
 calls integer NOT NULL CHECK (calls >= 0),
 PRIMARY KEY(user_id, day)
);
-- Aggregate only; no user identifier or message content. Survives account deletion
-- so deleting/recreating an account cannot refund the day's global spend budget.
CREATE TABLE llm_global_daily_usage (
 day date PRIMARY KEY,
 calls integer NOT NULL CHECK (calls >= 0)
);
