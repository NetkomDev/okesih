-- Migration 34: Add missing owner tables to Supabase Realtime publication
-- Ensures cross-device and multi-tab synchronization for menus, tables, staff, and waiters.

DO $$
BEGIN
  ALTER TABLE public.menus REPLICA IDENTITY FULL;
  ALTER TABLE public.warkop_tables REPLICA IDENTITY FULL;
  ALTER TABLE public.waiters REPLICA IDENTITY FULL;
  ALTER TABLE public.warkop_members REPLICA IDENTITY FULL;
EXCEPTION
  WHEN undefined_table THEN null;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.menus;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.warkop_tables;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.waiters;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.warkop_members;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
