CREATE EXTENSION pgcrypto;

CREATE TABLE users (
	id SERIAL PRIMARY KEY,
	public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
	role text,
	name text NOT NULL,
	surname text NOT NULL,
	email text UNIQUE NOT NULL,
	password text,
	secret_code uuid NOT NULL DEFAULT gen_random_uuid(),
	secret_active boolean NOT NULL DEFAULT false
	created_at timestamptz NOT NULL DEFAULT NOW(),
	updated_at timestamptz NOT NULL DEFAULT NOW(),
	partition text
);

CREATE INDEX users_email_index ON users (email);

CREATE TABLE refresh_sessions (
	id SERIAL PRIMARY KEY,
	user_id uuid REFERENCES users(public_id) ON DELETE CASCADE,
	refresh_token uuid NOT NULL,
	user_agent text NOT NULL,
	fingerprint text NOT NULL,
	expires_in bigint NOT NULL,
	createdAt timestamptz NOT NULL DEFAULT NOW()
);
