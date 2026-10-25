-- Photos are stored as compressed WebP objects; rows contain only the URL.
ALTER TABLE public.marketing_partners ADD COLUMN IF NOT EXISTS profile_photo_url text;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('partner-photos', 'partner-photos', true, 204800, ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
-- No client write policy: the authenticated, coordinator-only API owns writes.
