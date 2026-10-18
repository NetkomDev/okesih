-- Production pg_indexes checked on 2026-10-18: neither access path existed.
-- Small production tables (62 receipts / 121 items at inspection); fail quickly
-- on a busy table rather than waiting indefinitely for an index-build lock.
SET lock_timeout = '5s';
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON public.transaction_items (transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_warkop_created_id ON public.transactions (warkop_id, created_at DESC, id DESC);
RESET lock_timeout;
