-- Permanently remove revoked devices without leaving their pairing or retry data.
CREATE OR REPLACE FUNCTION public.delete_revoked_device(
  p_warkop_id UUID,
  p_device_id UUID,
  p_actor_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_device RECORD;
BEGIN
  SELECT id, pairing_request_id, device_type, device_name, status
  INTO v_device
  FROM public.device_installations
  WHERE id = p_device_id AND warkop_id = p_warkop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEVICE_NOT_FOUND';
  END IF;

  IF v_device.status <> 'REVOKED' THEN
    RAISE EXCEPTION 'DEVICE_MUST_BE_REVOKED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.shifts
    WHERE device_id = p_device_id AND status = 'OPEN'
  ) THEN
    RAISE EXCEPTION 'DEVICE_HAS_OPEN_SHIFT';
  END IF;

  INSERT INTO public.audit_logs (
    warkop_id, actor_user_id, action, target_type, target_id, metadata
  ) VALUES (
    p_warkop_id,
    p_actor_user_id,
    'DEVICE_DELETED',
    'device',
    p_device_id,
    jsonb_build_object(
      'device_type', v_device.device_type,
      'device_name', v_device.device_name
    )
  );

  -- operation_idempotency rows are removed by ON DELETE CASCADE. Historical
  -- shifts and audit entries remain, but their device reference becomes NULL.
  DELETE FROM public.device_installations WHERE id = p_device_id;

  IF v_device.pairing_request_id IS NOT NULL THEN
    DELETE FROM public.device_pairing_requests
    WHERE id = v_device.pairing_request_id;
  END IF;

  RETURN jsonb_build_object('id', p_device_id, 'deleted', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.delete_revoked_device(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_revoked_device(UUID, UUID, UUID) TO service_role;
