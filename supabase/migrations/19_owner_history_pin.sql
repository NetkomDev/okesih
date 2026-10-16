-- Migration 19: Tambah kolom history_pin_hash dan history_pin_salt pada tabel warkops
-- Digunakan untuk membatasi akses tab Histori Pesanan di layar Kasir hanya bagi Owner atau pemegang PIN.

ALTER TABLE public.warkops
    ADD COLUMN IF NOT EXISTS history_pin_hash TEXT,
    ADD COLUMN IF NOT EXISTS history_pin_salt TEXT;
