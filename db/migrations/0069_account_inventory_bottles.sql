INSERT INTO "account_inventory_adjustments" (
  "account_id",
  "inventory_item_id",
  "product_id",
  "sku",
  "product_name",
  "change_type",
  "delta_cases",
  "delta_bottles",
  "resulting_cases_on_hand",
  "resulting_bottles_on_hand",
  "effective_at",
  "notes",
  "created_by_user_id",
  "updated_by_user_id",
  "created_at",
  "updated_at"
)
SELECT
  inventory."account_id",
  inventory."id",
  inventory."product_id",
  inventory."sku",
  inventory."product_name",
  'manual_add',
  inventory."cases_on_hand",
  inventory."bottles_on_hand",
  inventory."cases_on_hand",
  inventory."bottles_on_hand",
  inventory."updated_at",
  'Initial balance backfilled before bottle-only inventory normalization.',
  inventory."updated_by_user_id",
  inventory."updated_by_user_id",
  inventory."created_at",
  now()
FROM "account_inventory_on_hand" AS inventory
WHERE NOT EXISTS (
  SELECT 1
  FROM "account_inventory_adjustments" AS adjustment
  WHERE adjustment."account_id" = inventory."account_id"
    AND adjustment."product_id" = inventory."product_id"
)
  AND (inventory."cases_on_hand" <> 0 OR inventory."bottles_on_hand" <> 0);
--> statement-breakpoint
UPDATE "account_inventory_adjustments" AS adjustment
SET
  "delta_bottles" = adjustment."delta_bottles"
    + (adjustment."delta_cases" * product."bottles_per_case"),
  "delta_cases" = 0,
  "resulting_bottles_on_hand" = adjustment."resulting_bottles_on_hand"
    + (adjustment."resulting_cases_on_hand" * product."bottles_per_case"),
  "resulting_cases_on_hand" = 0,
  "updated_at" = now()
FROM "products" AS product
WHERE product."id" = adjustment."product_id";
--> statement-breakpoint
UPDATE "account_inventory_on_hand" AS inventory
SET
  "bottles_on_hand" = inventory."bottles_on_hand"
    + (inventory."cases_on_hand" * product."bottles_per_case"),
  "cases_on_hand" = 0,
  "quantity_on_hand" = inventory."bottles_on_hand"
    + (inventory."cases_on_hand" * product."bottles_per_case"),
  "unit_type" = 'bottle'
FROM "products" AS product
WHERE product."id" = inventory."product_id";
