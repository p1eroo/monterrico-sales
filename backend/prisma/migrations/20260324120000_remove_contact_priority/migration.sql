-- Remove priority from Contact (UI and domain no longer use it)
ALTER TABLE "Contact" DROP COLUMN IF EXISTS "priority";
