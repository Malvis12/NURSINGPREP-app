-- Migration: 20261124000028_fix_profiles_level_check.sql
-- Description: Updates profiles_level_check constraint to allow 100 Level alongside 200, 300, 400.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_level_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_level_check CHECK (level IN (100, 200, 300, 400));
