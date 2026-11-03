-- 001_schema.sql  (owner-approved PostgreSQL 18 baseline)
-- Money is stored as integer VND (the dong has no minor unit), never as float.
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE txn_type AS ENUM ('expense', 'income');

CREATE TABLE users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         citext      NOT NULL UNIQUE,
  password_hash text        NOT NULL,
  display_name  text        NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  timezone      text        NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- user_id IS NULL  => system default category shared by everyone
CREATE TABLE categories (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint REFERENCES users(id) ON DELETE CASCADE,
  key     text     NOT NULL CHECK (key ~ '^[a-z_]{2,40}$'),
  name_vi text     NOT NULL,
  type    txn_type NOT NULL,
  UNIQUE NULLS NOT DISTINCT (user_id, key),
  UNIQUE (id, user_id)
);

CREATE TABLE transactions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        txn_type    NOT NULL,
  amount_vnd  bigint      NOT NULL CHECK (amount_vnd > 0 AND amount_vnd <= 100000000000),
  category_id bigint      NOT NULL REFERENCES categories(id),
  note        text        NOT NULL DEFAULT '' CHECK (char_length(note) <= 300),
  occurred_on date        NOT NULL,
  source_text text,       -- original chat message; nullable so the user can erase it
  parse_meta  jsonb,      -- {parser_version, path: rules|llm, confidence, flags[]}
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE budgets (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id bigint NOT NULL REFERENCES categories(id),
  month       date   NOT NULL CHECK (month = date_trunc('month', month)::date),
  limit_vnd   bigint NOT NULL CHECK (limit_vnd > 0),
  UNIQUE (user_id, category_id, month)
);

CREATE TABLE goals (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (id, user_id),
  name        text   NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  target_vnd  bigint NOT NULL CHECK (target_vnd > 0),
  deadline    date   NOT NULL,
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE goal_contributions (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  goal_id        bigint NOT NULL,
  FOREIGN KEY (goal_id, user_id) REFERENCES goals(id, user_id) ON DELETE CASCADE,
  user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- denormalised on purpose: cheap isolation checks
  amount_vnd     bigint NOT NULL CHECK (amount_vnd > 0),
  contributed_on date   NOT NULL,
  note           text   NOT NULL DEFAULT ''
);

-- Cache of LLM extractions keyed by a hash of the normalised message (saves cost, makes evals repeatable).
CREATE TABLE llm_cache (
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        text NOT NULL,
  PRIMARY KEY (user_id, key),
  response   jsonb       NOT NULL,
  model      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX budgets_user_month_idx      ON budgets (user_id, month);
CREATE INDEX goals_user_idx              ON goals (user_id) WHERE archived_at IS NULL;
CREATE INDEX goal_contrib_goal_idx       ON goal_contributions (goal_id);

INSERT INTO categories (user_id, key, name_vi, type) VALUES
  (NULL, 'an_uong',   'Ăn uống',        'expense'),
  (NULL, 'di_chuyen', 'Đi lại',         'expense'),
  (NULL, 'nha_tro',   'Nhà trọ',        'expense'),
  (NULL, 'hoc_tap',   'Học tập',        'expense'),
  (NULL, 'giai_tri',  'Giải trí',       'expense'),
  (NULL, 'mua_sam',   'Mua sắm',        'expense'),
  (NULL, 'suc_khoe',  'Sức khỏe',       'expense'),
  (NULL, 'hoa_don',   'Hóa đơn',        'expense'),
  (NULL, 'khac',      'Khác',           'expense'),
  (NULL, 'tro_cap',   'Gia đình gửi',   'income'),
  (NULL, 'luong',     'Lương',          'income'),
  (NULL, 'lam_them',  'Làm thêm',       'income'),
  (NULL, 'thu_khac',  'Thu khác',       'income');
