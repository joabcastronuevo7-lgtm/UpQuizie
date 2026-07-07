-- Profile pictures. Safe to run against an existing database.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
