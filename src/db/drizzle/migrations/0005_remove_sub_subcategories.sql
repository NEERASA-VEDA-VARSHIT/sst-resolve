-- Remove sub_subcategories table and related foreign key
-- This migration drops the sub_subcategories table and removes the sub_subcategory_id column from tickets

-- First, drop the foreign key constraint from tickets table
ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "tickets_sub_subcategory_id_sub_subcategories_id_fk";

-- Drop the sub_subcategory_id column from tickets table
ALTER TABLE "tickets" DROP COLUMN IF EXISTS "sub_subcategory_id";

-- Drop indexes on sub_subcategories table
DROP INDEX IF EXISTS "idx_sub_subcategories_subcategory";

-- Drop the sub_subcategories table
DROP TABLE IF EXISTS "sub_subcategories";
