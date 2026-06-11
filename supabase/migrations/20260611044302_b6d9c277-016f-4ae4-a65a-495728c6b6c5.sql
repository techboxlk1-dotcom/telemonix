
-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  emoji text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public all" ON public.categories FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.categories (slug, name, emoji, sort_order) VALUES
  ('tech','Tech','💻',1),
  ('news','News','📰',2),
  ('crypto','Crypto','🪙',3),
  ('entertainment','Entertainment','🎬',4),
  ('education','Education','📚',5),
  ('business','Business','💼',6),
  ('lifestyle','Lifestyle','✨',7),
  ('gaming','Gaming','🎮',8),
  ('other','Other','🌐',99);

-- ============ PROFILE EXPANSION ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'publisher',
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referrer_id bigint,
  ADD COLUMN IF NOT EXISTS advertiser_balance_usd numeric(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS publisher_balance_usd numeric(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

UPDATE public.profiles SET referral_code = upper(substr(md5(telegram_user_id::text), 1, 8)) WHERE referral_code IS NULL;

-- ============ CHANNEL EXPANSION ============
ALTER TABLE public.telegram_channels
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id),
  ADD COLUMN IF NOT EXISTS accumulated_usd numeric(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Allow updates from the app
DROP POLICY IF EXISTS "public update channels" ON public.telegram_channels;
CREATE POLICY "public update channels" ON public.telegram_channels FOR UPDATE USING (true) WITH CHECK (true);

-- ============ AD CAMPAIGNS ============
CREATE TABLE public.ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id bigint NOT NULL,
  text text NOT NULL DEFAULT '',
  image_base64 text,
  button_text text NOT NULL,
  button_url text NOT NULL,
  category_id uuid REFERENCES public.categories(id),
  watermark boolean NOT NULL DEFAULT true,
  target_views int NOT NULL DEFAULT 100,
  target_clicks int NOT NULL DEFAULT 100,
  views_count int NOT NULL DEFAULT 0,
  clicks_count int NOT NULL DEFAULT 0,
  view_rate_usd numeric(12,4) NOT NULL DEFAULT 0.001,  -- per view (=$1/1000)
  click_rate_usd numeric(12,4) NOT NULL DEFAULT 0.01,  -- per click (=$10/1000)
  budget_usd numeric(12,4) NOT NULL DEFAULT 0,
  spent_usd numeric(12,4) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_review', -- pending_review | active | complete | rejected | cancelled
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_campaigns TO anon, authenticated;
GRANT ALL ON public.ad_campaigns TO service_role;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_campaigns public all" ON public.ad_campaigns FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_ad_campaigns_updated_at BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AD PLACEMENTS ============
CREATE TABLE public.ad_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.telegram_channels(id) ON DELETE CASCADE,
  chat_id text NOT NULL,
  message_id bigint,
  views int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (campaign_id, channel_id, sent_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_placements TO anon, authenticated;
GRANT ALL ON public.ad_placements TO service_role;
ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_placements public all" ON public.ad_placements FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_ad_placements_campaign ON public.ad_placements(campaign_id);
CREATE INDEX idx_ad_placements_channel ON public.ad_placements(channel_id);

-- ============ REFERRALS ============
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id bigint NOT NULL,
  referred_id bigint NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referrals TO anon, authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals public all" ON public.referrals FOR ALL USING (true) WITH CHECK (true);

-- ============ EARNINGS LEDGER ============
CREATE TABLE public.earnings_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL,
  channel_id uuid REFERENCES public.telegram_channels(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.ad_campaigns(id) ON DELETE SET NULL,
  type text NOT NULL, -- 'publisher_view' | 'publisher_click' | 'referral'
  amount_usd numeric(12,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.earnings_ledger TO anon, authenticated;
GRANT ALL ON public.earnings_ledger TO service_role;
ALTER TABLE public.earnings_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "earnings public all" ON public.earnings_ledger FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_earnings_user ON public.earnings_ledger(user_id);

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL,
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon, authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications public all" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- ============ SENT_MESSAGES EXPANSION ============
ALTER TABLE public.sent_messages
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.ad_campaigns(id) ON DELETE SET NULL;

-- ============ APP SETTINGS SEEDS ============
INSERT INTO public.app_settings (key, value_num) VALUES
  ('view_rate_usd', 0.001),
  ('click_rate_usd', 0.01),
  ('publisher_share_pct', 65),
  ('referral_pct', 10),
  ('min_views', 100),
  ('min_clicks', 100),
  ('max_display_cpm', 5),
  ('min_display_cpm', 1)
ON CONFLICT (key) DO NOTHING;
