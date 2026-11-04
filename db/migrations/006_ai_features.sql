ALTER TABLE transactions ADD CONSTRAINT transactions_id_user_unique UNIQUE (id,user_id);
CREATE TABLE ai_preferences (
 user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 voice_enabled boolean NOT NULL DEFAULT false,
 semantic_enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE transaction_embeddings (
 user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 transaction_id bigint NOT NULL,
 model text NOT NULL,
 note_hash text NOT NULL,
 embedding double precision[] NOT NULL CHECK(array_length(embedding,1)=768),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,transaction_id,model),
 FOREIGN KEY(transaction_id,user_id) REFERENCES transactions(id,user_id) ON DELETE CASCADE
);
CREATE FUNCTION invalidate_transaction_embedding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.note IS DISTINCT FROM OLD.note THEN
  DELETE FROM transaction_embeddings WHERE user_id=OLD.user_id AND transaction_id=OLD.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invalidate_transaction_embedding AFTER UPDATE OF note ON transactions
 FOR EACH ROW EXECUTE FUNCTION invalidate_transaction_embedding();
