-- 002_reporting_indexes.sql
-- Covering index: month/year reports become index-only scans (no heap fetches once the table is vacuumed).
CREATE INDEX transactions_user_date_cover_idx
  ON transactions (user_id, occurred_on DESC) INCLUDE (type, amount_vnd, category_id);
