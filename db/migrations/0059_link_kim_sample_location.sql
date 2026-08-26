-- The portal has separate admin, driver, and sales accounts for Kimberly.
-- The named sample location belongs to the primary admin account.
UPDATE "inventory_locations"
SET "owner_user_id" = (
  SELECT "id"
  FROM "users"
  WHERE lower("email") = 'kim@ahawc.com'
    AND "active" = true
  LIMIT 1
)
WHERE "name" = 'Kim - Samples Maryland'
  AND EXISTS (
    SELECT 1
    FROM "users"
    WHERE lower("email") = 'kim@ahawc.com'
      AND "active" = true
  );
