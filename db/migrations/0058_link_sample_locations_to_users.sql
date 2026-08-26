-- Associate the three named sample locations with the people responsible for
-- their inventory. Prefer the explicit "User <name>" account when present,
-- while still supporting normal full names that begin with the same first name.
UPDATE "inventory_locations"
SET "owner_user_id" = (
  SELECT "id"
  FROM "users"
  WHERE "active" = true
    AND (lower("name") = 'user emily' OR lower(split_part("name", ' ', 1)) = 'emily')
  ORDER BY CASE WHEN lower("name") = 'user emily' THEN 0 ELSE 1 END, "created_at"
  LIMIT 1
)
WHERE "name" = 'Emily - Samples Chicago'
  AND EXISTS (
    SELECT 1 FROM "users"
    WHERE "active" = true
      AND (lower("name") = 'user emily' OR lower(split_part("name", ' ', 1)) = 'emily')
  );

UPDATE "inventory_locations"
SET "owner_user_id" = (
  SELECT "id"
  FROM "users"
  WHERE "active" = true
    AND (lower("name") = 'user kim' OR lower(split_part("name", ' ', 1)) = 'kim')
  ORDER BY CASE WHEN lower("name") = 'user kim' THEN 0 ELSE 1 END, "created_at"
  LIMIT 1
)
WHERE "name" = 'Kim - Samples Maryland'
  AND EXISTS (
    SELECT 1 FROM "users"
    WHERE "active" = true
      AND (lower("name") = 'user kim' OR lower(split_part("name", ' ', 1)) = 'kim')
  );

UPDATE "inventory_locations"
SET "owner_user_id" = (
  SELECT "id"
  FROM "users"
  WHERE "active" = true
    AND (lower("name") = 'user kristen' OR lower(split_part("name", ' ', 1)) = 'kristen')
  ORDER BY CASE WHEN lower("name") = 'user kristen' THEN 0 ELSE 1 END, "created_at"
  LIMIT 1
)
WHERE "name" = 'Kristen - Samples Kildeer'
  AND EXISTS (
    SELECT 1 FROM "users"
    WHERE "active" = true
      AND (lower("name") = 'user kristen' OR lower(split_part("name", ' ', 1)) = 'kristen')
  );
