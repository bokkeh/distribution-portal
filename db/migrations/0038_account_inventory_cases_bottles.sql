ALTER TABLE "account_inventory_on_hand"
ADD COLUMN "cases_on_hand" numeric(10, 2) DEFAULT '0' NOT NULL,
ADD COLUMN "bottles_on_hand" numeric(10, 2) DEFAULT '0' NOT NULL;

UPDATE "account_inventory_on_hand"
SET "cases_on_hand" = COALESCE("quantity_on_hand", 0),
    "bottles_on_hand" = 0
WHERE COALESCE("cases_on_hand", 0) = 0
  AND COALESCE("bottles_on_hand", 0) = 0;
