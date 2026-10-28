ALTER TABLE orders ADD COLUMN IF NOT EXISTS operations_revision integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL;
