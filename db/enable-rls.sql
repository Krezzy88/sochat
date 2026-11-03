-- Explicit administrator-only step, after backup. Not a normal/native migration.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sochat_tenant') THEN
  CREATE ROLE sochat_tenant NOLOGIN NOSUPERUSER NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO sochat_tenant;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO sochat_tenant;
GRANT SELECT,INSERT,UPDATE,DELETE ON users,categories,transactions,budgets,goals,goal_contributions,llm_cache,llm_daily_usage,llm_global_daily_usage,batch_requests,api_rate_limits,ai_preferences,transaction_embeddings TO sochat_tenant;
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['transactions','budgets','goals','goal_contributions','llm_cache','llm_daily_usage','batch_requests','api_rate_limits','ai_preferences','transaction_embeddings'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',table_name);
  EXECUTE format('DROP POLICY IF EXISTS owner_scope ON %I',table_name);
  EXECUTE format('CREATE POLICY owner_scope ON %I TO sochat_tenant USING (user_id=NULLIF(current_setting(''sochat.user_id'',true),'''')::bigint) WITH CHECK (user_id=NULLIF(current_setting(''sochat.user_id'',true),'''')::bigint)',table_name);
 END LOOP;
END $$;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_self ON users;
CREATE POLICY user_self ON users TO sochat_tenant USING(id=NULLIF(current_setting('sochat.user_id',true),'')::bigint) WITH CHECK(id=NULLIF(current_setting('sochat.user_id',true),'')::bigint);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS category_read ON categories;
DROP POLICY IF EXISTS category_write ON categories;
CREATE POLICY category_read ON categories FOR SELECT TO sochat_tenant USING(user_id IS NULL OR user_id=NULLIF(current_setting('sochat.user_id',true),'')::bigint);
CREATE POLICY category_write ON categories FOR ALL TO sochat_tenant USING(user_id=NULLIF(current_setting('sochat.user_id',true),'')::bigint) WITH CHECK(user_id=NULLIF(current_setting('sochat.user_id',true),'')::bigint);
COMMIT;
