CREATE TABLE sessions (
 sid varchar PRIMARY KEY,
 sess json NOT NULL,
 expire timestamp(6) NOT NULL,
 user_id bigint GENERATED ALWAYS AS ((sess->>'userId')::bigint) STORED REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX sessions_expire_idx ON sessions(expire);
CREATE TABLE batch_requests (
 user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 key uuid NOT NULL,
 request_hash text NOT NULL,
 response jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,key)
);
CREATE TABLE api_rate_limits (
 key text PRIMARY KEY,
 user_id bigint REFERENCES users(id) ON DELETE CASCADE,
 count integer NOT NULL CHECK(count > 0),
 expires_at timestamptz NOT NULL
);
CREATE INDEX api_rate_limits_expiry_idx ON api_rate_limits(expires_at);
