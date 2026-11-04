ALTER TABLE transactions ADD COLUMN version bigint NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE goals ADD COLUMN version bigint NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE budgets ADD COLUMN version bigint NOT NULL DEFAULT 1 CHECK(version>0);
CREATE FUNCTION bump_record_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.version:=OLD.version+1; RETURN NEW; END $$;
CREATE TRIGGER transactions_version BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER goals_version BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION bump_record_version();
CREATE TRIGGER budgets_version BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION bump_record_version();
