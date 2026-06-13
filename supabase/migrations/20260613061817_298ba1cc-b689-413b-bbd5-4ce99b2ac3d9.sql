
-- Link sent_messages to saved_posts for bulk delete-from-channels
ALTER TABLE public.sent_messages ADD COLUMN IF NOT EXISTS saved_post_id uuid;
CREATE INDEX IF NOT EXISTS sent_messages_saved_post_id_idx ON public.sent_messages(saved_post_id);

-- Smart CTA suggestion stored on saved_posts (admin can override)
ALTER TABLE public.saved_posts ADD COLUMN IF NOT EXISTS cta_suggested text;

-- Short tracking URLs: /r/<code> -> target sent_messages or ad_placement click flow
CREATE TABLE IF NOT EXISTS public.short_links (
  code text PRIMARY KEY,
  kind text NOT NULL,                 -- 'ad' | 'post'
  ref_id uuid NOT NULL,               -- sent_messages.id OR ad_placements.id
  src text NOT NULL DEFAULT 'button', -- 'button' | 'link'
  target_url text,                    -- for in-text link rewriting
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.short_links TO anon;
GRANT ALL ON public.short_links TO service_role;
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read short_links" ON public.short_links FOR SELECT USING (true);
