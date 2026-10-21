-- Restrict direct table mutations; application APIs are the write boundary.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
REVOKE ALL ON FUNCTION public.close_waiter_shift(uuid,numeric,text) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.close_waiter_shift(uuid,numeric,text) SET search_path=public,pg_temp;
GRANT EXECUTE ON FUNCTION public.close_waiter_shift(uuid,numeric,text) TO service_role;
CREATE OR REPLACE FUNCTION public.current_user_warkop_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT m.warkop_id FROM public.warkop_members m JOIN public.warkops w ON w.id=m.warkop_id
  WHERE m.user_id=auth.uid() AND m.is_active AND w.is_active ORDER BY m.created_at,m.id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.current_user_warkop_id() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.current_user_warkop_id() TO authenticated,service_role;
DROP POLICY IF EXISTS "Staff can manage menus of their warkop" ON public.menus;
DROP POLICY IF EXISTS "Staff can manage warkop transactions" ON public.transactions;
DROP POLICY IF EXISTS "Staff can manage waiter shifts" ON public.waiter_shifts;
DROP POLICY IF EXISTS "Public can view warkop basic info" ON public.warkops;
REVOKE ALL ON public.warkops FROM anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.menus,public.transactions,public.transaction_items,public.waiter_shifts,public.shifts FROM anon,authenticated;
CREATE POLICY "Active tenant staff read transactions" ON public.transactions FOR SELECT TO authenticated
USING (warkop_id=public.current_user_warkop_id());
CREATE POLICY "Active tenant staff read menus" ON public.menus FOR SELECT TO authenticated
USING (warkop_id=public.current_user_warkop_id());
CREATE POLICY "Active tenant staff read waiter shifts" ON public.waiter_shifts FOR SELECT TO authenticated
USING (warkop_id=public.current_user_warkop_id());

CREATE TABLE public.api_rate_limits (
  bucket text PRIMARY KEY, hits integer NOT NULL CHECK(hits>0), expires_at timestamptz NOT NULL
);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limits FROM anon,authenticated;
CREATE INDEX api_rate_limits_expiry ON public.api_rate_limits(expires_at);
CREATE FUNCTION public.consume_api_limit(p_bucket text,p_limit integer,p_window_seconds integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.api_rate_limits%ROWTYPE;
BEGIN
 IF p_limit<1 OR p_window_seconds<1 OR p_window_seconds>86400 OR length(p_bucket)>200 THEN RAISE EXCEPTION 'Invalid limit'; END IF;
 INSERT INTO public.api_rate_limits(bucket,hits,expires_at) VALUES(p_bucket,1,now()+make_interval(secs=>p_window_seconds))
 ON CONFLICT(bucket) DO UPDATE SET
 hits=CASE WHEN api_rate_limits.expires_at<=now() THEN 1 ELSE least(api_rate_limits.hits+1,p_limit+1) END,
 expires_at=CASE WHEN api_rate_limits.expires_at<=now() THEN now()+make_interval(secs=>p_window_seconds) ELSE api_rate_limits.expires_at END
 RETURNING * INTO v;
 RETURN jsonb_build_object('allowed',v.hits<=p_limit,'retryAfter',greatest(1,ceil(extract(epoch from v.expires_at-now()))));
END $$;
REVOKE ALL ON FUNCTION public.consume_api_limit(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_limit(text,integer,integer) TO service_role;

CREATE TABLE public.tenant_audit_pins (
 warkop_id uuid PRIMARY KEY REFERENCES public.warkops(id) ON DELETE CASCADE,
 pin_hash text, version uuid NOT NULL DEFAULT gen_random_uuid(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tenant_audit_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_audit_pins FROM anon,authenticated;
INSERT INTO public.tenant_audit_pins(warkop_id,pin_hash)
SELECT DISTINCT ON(warkop_id) warkop_id,extensions.crypt(trim(substr(display_name,11)),extensions.gen_salt('bf',10))
FROM public.warkop_members WHERE role='OWNER' AND display_name LIKE 'AUDIT_PIN:%'
ORDER BY warkop_id,created_at,id;
UPDATE public.warkop_members SET display_name=NULL WHERE role='OWNER' AND display_name LIKE 'AUDIT_PIN:%';
CREATE FUNCTION public.set_tenant_audit_pin(p_warkop_id uuid,p_pin text,p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.warkop_members WHERE warkop_id=p_warkop_id AND user_id=p_actor AND role='OWNER' AND is_active) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_pin IS NOT NULL AND p_pin !~ '^[0-9]{4,6}$' THEN RAISE EXCEPTION 'Invalid PIN'; END IF;
 INSERT INTO public.tenant_audit_pins(warkop_id,pin_hash) VALUES(p_warkop_id,CASE WHEN p_pin IS NULL THEN NULL ELSE extensions.crypt(p_pin,extensions.gen_salt('bf',10)) END)
 ON CONFLICT(warkop_id) DO UPDATE SET pin_hash=EXCLUDED.pin_hash,version=gen_random_uuid(),updated_at=now();
 INSERT INTO public.audit_logs(warkop_id,actor_user_id,action,target_type,target_id)
 VALUES(p_warkop_id,p_actor,CASE WHEN p_pin IS NULL THEN 'OWNER_AUDIT_PIN_DISABLED' ELSE 'OWNER_AUDIT_PIN_SET' END,'warkop',p_warkop_id);
END $$;
CREATE FUNCTION public.verify_tenant_audit_pin(p_warkop_id uuid,p_pin text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
 SELECT CASE WHEN pin_hash IS NULL THEN true ELSE pin_hash=extensions.crypt(p_pin,pin_hash) END FROM public.tenant_audit_pins WHERE warkop_id=p_warkop_id;
$$;
REVOKE ALL ON FUNCTION public.set_tenant_audit_pin(uuid,text,uuid),public.verify_tenant_audit_pin(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_tenant_audit_pin(uuid,text,uuid),public.verify_tenant_audit_pin(uuid,text) TO service_role;
GRANT ALL ON public.api_rate_limits,public.tenant_audit_pins TO service_role;
COMMIT;
