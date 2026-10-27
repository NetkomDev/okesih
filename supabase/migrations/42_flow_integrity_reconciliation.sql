BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
-- Reconcile verified production drift: migration history alone did not prove these guards exist.
CREATE OR REPLACE FUNCTION public.current_user_warkop_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT (array_agg(m.warkop_id))[1] FROM public.warkop_members m JOIN public.warkops w ON w.id=m.warkop_id
 WHERE m.user_id=auth.uid() AND m.is_active AND w.is_active HAVING count(*)=1;
$$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public.menus'::regclass AND conname='menus_price_nonnegative') THEN
  ALTER TABLE public.menus ADD CONSTRAINT menus_price_nonnegative CHECK(harga>=0) NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public.transactions'::regclass AND conname='transactions_total_nonnegative') THEN
  ALTER TABLE public.transactions ADD CONSTRAINT transactions_total_nonnegative CHECK(total_harga>=0) NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public.transaction_items'::regclass AND conname='items_values_valid') THEN
  ALTER TABLE public.transaction_items ADD CONSTRAINT items_values_valid CHECK(qty>0 AND harga_satuan>=0) NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public.shifts'::regclass AND conname IN ('shifts_id_tenant_unique','shifts_id_warkop_id_key')) THEN
  ALTER TABLE public.shifts ADD CONSTRAINT shifts_id_tenant_unique UNIQUE(id,warkop_id);
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public.menus'::regclass AND conname='menus_id_tenant_unique') THEN
  ALTER TABLE public.menus ADD CONSTRAINT menus_id_tenant_unique UNIQUE(id,warkop_id);
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public.transactions'::regclass AND conname='transactions_id_tenant_unique') THEN
  ALTER TABLE public.transactions ADD CONSTRAINT transactions_id_tenant_unique UNIQUE(id,warkop_id);
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public.transactions'::regclass AND conname='transaction_shift_tenant_fk') THEN
  ALTER TABLE public.transactions ADD CONSTRAINT transaction_shift_tenant_fk FOREIGN KEY(shift_id,warkop_id) REFERENCES public.shifts(id,warkop_id) NOT VALID;
 END IF;
END $$;
ALTER TABLE public.transaction_items ADD COLUMN IF NOT EXISTS warkop_id uuid;
UPDATE public.transaction_items i SET warkop_id=t.warkop_id FROM public.transactions t WHERE t.id=i.transaction_id;
ALTER TABLE public.transaction_items ALTER COLUMN warkop_id SET NOT NULL;
CREATE OR REPLACE FUNCTION public.assign_item_tenant() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 SELECT warkop_id INTO NEW.warkop_id FROM public.transactions WHERE id=NEW.transaction_id;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS assign_item_tenant ON public.transaction_items;
CREATE TRIGGER assign_item_tenant BEFORE INSERT OR UPDATE ON public.transaction_items FOR EACH ROW EXECUTE FUNCTION public.assign_item_tenant();
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public.transaction_items'::regclass AND conname='item_transaction_tenant_fk') THEN
  ALTER TABLE public.transaction_items ADD CONSTRAINT item_transaction_tenant_fk FOREIGN KEY(transaction_id,warkop_id) REFERENCES public.transactions(id,warkop_id) ON DELETE CASCADE NOT VALID;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public.transaction_items'::regclass AND conname='item_menu_tenant_fk') THEN
  ALTER TABLE public.transaction_items ADD CONSTRAINT item_menu_tenant_fk FOREIGN KEY(menu_id,warkop_id) REFERENCES public.menus(id,warkop_id) NOT VALID;
 END IF;
END $$;
ALTER TABLE public.menus VALIDATE CONSTRAINT menus_price_nonnegative;
ALTER TABLE public.transactions VALIDATE CONSTRAINT transactions_total_nonnegative;
ALTER TABLE public.transactions VALIDATE CONSTRAINT transaction_shift_tenant_fk;
ALTER TABLE public.transaction_items VALIDATE CONSTRAINT items_values_valid;
ALTER TABLE public.transaction_items VALIDATE CONSTRAINT item_transaction_tenant_fk;
ALTER TABLE public.transaction_items VALIDATE CONSTRAINT item_menu_tenant_fk;
CREATE OR REPLACE FUNCTION public.approve_device_pairing(p_warkop_id uuid,p_actor uuid,p_code_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.device_pairing_requests%ROWTYPE; d public.device_installations%ROWTYPE;
BEGIN
 PERFORM 1 FROM public.warkops WHERE id=p_warkop_id AND is_active AND archived_at IS NULL FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.warkop_members WHERE warkop_id=p_warkop_id AND user_id=p_actor AND role='OWNER' AND is_active) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO p FROM public.device_pairing_requests WHERE code_hash=p_code_hash AND status='PENDING' AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Kode pairing tidak valid atau sudah digunakan.'; END IF;
 INSERT INTO public.device_installations(warkop_id,pairing_request_id,device_type,device_name,token_hash,paired_by,expires_at)
 VALUES(p_warkop_id,p.id,p.device_type,p.device_name,p.poll_secret_hash,p_actor,now()+interval '180 days') RETURNING * INTO d;
 UPDATE public.device_pairing_requests SET warkop_id=p_warkop_id,status='APPROVED',approved_by=p_actor,approved_at=now() WHERE id=p.id;
 INSERT INTO public.audit_logs(warkop_id,actor_user_id,device_id,action,target_type,target_id) VALUES(p_warkop_id,p_actor,d.id,'DEVICE_PAIRED','device',d.id);
 RETURN to_jsonb(d)-'token_hash';
END $$;
REVOKE ALL ON FUNCTION public.approve_device_pairing(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.approve_device_pairing(uuid,uuid,text) TO service_role;

-- Settlement identity/date determine realized revenue and must remain immutable.
CREATE OR REPLACE FUNCTION public.guard_settled_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.commission_settled_at IS NOT NULL OR OLD.status_bayar = 'PAID' THEN
      RAISE EXCEPTION 'Tagihan yang sudah dilunasi/diselesaikan tidak dapat dihapus.' USING ERRCODE='23514';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND (OLD.commission_settled_at IS NOT NULL OR OLD.status_bayar = 'PAID') THEN
    IF (NEW.status_bayar, NEW.warkop_id, NEW.tanggal, NEW.total_transactions, NEW.tagihan_pokok, NEW.kode_unik, NEW.total_tagihan, NEW.commission_settled_at, NEW.settled_by, NEW.settlement_reference, to_jsonb(NEW)->'shift_id')
      IS DISTINCT FROM (OLD.status_bayar, OLD.warkop_id, OLD.tanggal, OLD.total_transactions, OLD.tagihan_pokok, OLD.kode_unik, OLD.total_tagihan, OLD.commission_settled_at, OLD.settled_by, OLD.settlement_reference, to_jsonb(OLD)->'shift_id') THEN
      RAISE EXCEPTION 'Tagihan yang sudah berstatus PAID tidak dapat diubah nominalnya.' USING ERRCODE='23514';
    END IF;
  ELSE
    NEW.commission_settled_at := CASE WHEN NEW.status_bayar = 'PAID' THEN now() ELSE NULL END;
  END IF;

  RETURN NEW;
END $$;


REVOKE ALL ON FUNCTION public.create_customer_order(uuid,text,payment_method_type,text,jsonb,numeric,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
