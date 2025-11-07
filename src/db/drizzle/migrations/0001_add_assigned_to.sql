-- Add assigned_to column to tickets table
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "assigned_to" text;

