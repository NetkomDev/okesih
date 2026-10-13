-- Existing owners have already passed their first login before the multi-PWA
-- rollout. Mark only those accounts as complete. New tenant registration now
-- creates an explicit, incomplete owner_onboarding row.
INSERT INTO public.owner_onboarding (
  warkop_id,
  owner_user_id,
  password_changed_at,
  owner_pwa_installed_at,
  completed_at
)
SELECT
  member.warkop_id,
  member.user_id,
  now(),
  now(),
  now()
FROM public.warkop_members AS member
WHERE member.role = 'OWNER'
ON CONFLICT (warkop_id) DO NOTHING;
