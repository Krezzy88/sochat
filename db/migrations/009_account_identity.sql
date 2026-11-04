ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
CREATE TABLE auth_identities (
  provider text NOT NULL CHECK (provider='google'),
  subject text NOT NULL,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(provider,subject),
  UNIQUE(provider,user_id)
);
CREATE TABLE account_tokens (
  token_hash text PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify','reset')),
  expires_at timestamptz NOT NULL,
  UNIQUE(user_id,purpose)
);
CREATE INDEX account_tokens_expiry ON account_tokens(expires_at);
