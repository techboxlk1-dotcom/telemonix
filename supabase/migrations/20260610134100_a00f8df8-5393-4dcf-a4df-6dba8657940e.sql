
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value_num NUMERIC,
  value_text TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT SELECT ON public.app_settings TO anon;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "settings public write" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.app_settings (key, value_num) VALUES ('cpm_usd', 1.00)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.sent_messages ADD COLUMN IF NOT EXISTS button_url TEXT;
ALTER TABLE public.sent_messages ADD COLUMN IF NOT EXISTS clicks INTEGER NOT NULL DEFAULT 0;
