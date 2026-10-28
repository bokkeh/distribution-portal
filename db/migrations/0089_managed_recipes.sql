CREATE TABLE IF NOT EXISTS managed_recipes (
 handle text PRIMARY KEY, title text NOT NULL, ingredients jsonb NOT NULL DEFAULT '[]', steps jsonb NOT NULL DEFAULT '[]',
 seasons jsonb NOT NULL DEFAULT '[]', available_from date, available_until date, status text NOT NULL DEFAULT 'draft',
 updated_by uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS recipe_selections (scope text PRIMARY KEY, handle text NOT NULL, updated_by uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
INSERT INTO managed_recipes(handle, title) VALUES ('wisher-autumn-sunrise', 'Wisher Autumn Sunrise') ON CONFLICT DO NOTHING;
