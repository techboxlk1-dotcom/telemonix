# TeleMonix

Telegram Ad Network — publishers monetize channels, advertisers reach audiences, fully automated tracking and payouts.

---

## 🚀 Hosting — කොහෙද host කරන්නේ?

මේ project එක **TanStack Start** stack එකකින් හදලා, **server functions** (tracking links, Telegram webhook, AI CTA suggest, ad distribution cron, deposit watcher) අවශ්‍යයි. ඒ නිසා **plain static hosting (GitHub Pages, basic Netlify static)** වැඩ කරන්නේ නෑ — server runtime එකක් ඕනේ.

### ✅ Recommended: Lovable Hosting (already live)

ඔයාගේ project එක දැනටමත් **https://telemonix.lovable.app** එකේ full backend එක්ක live වෙලා තියෙනවා. මේක ම use කරන්න:

- ✅ Server functions automatic deploy
- ✅ Env vars (SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, LOVABLE_API_KEY) automatic injected — මුකුත් configure කරන්න ඕනේ නෑ
- ✅ `/api/public/telegram/webhook`, `/r/:code`, `/api/public/cron/distribute` හැම එකක්ම වැඩ කරනවා
- ✅ Custom domain attach කරන්න පුළුවන් — **Lovable → Project Settings → Domains → Connect Domain**

### Netlify එකේ වැඩ කරවන්න උත්සහ කරනවා නම්

Netlify එකේ TanStack Start server functions රන් කරන්න `@netlify/vite-plugin-tanstack-start` adapter එකක් wire කරන්න ඕනේ — ඒ change එක මේ Lovable preset (`@lovable.dev/vite-tanstack-config`, Cloudflare target) එක්ක conflict වෙනවා. Recommendation: Netlify path එක skip කරලා Lovable hosting + custom domain use කරන්න. 

ඔයාගේ `gotelemonix.netlify.app` 404 එනවා වෙන්නේ Netlify එක static SPA විදිහට publish කරපු නිසා — `/api/*`, `/r/*` routes server එකේ run වෙන්න ඕනේ.

---

## 🔑 Environment Variables

Lovable Cloud එකේ දැනටමත් set වෙලා (manual configure ඕනේ නෑ):

| Variable | Type | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | public | Browser → Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | public | Browser → Supabase (RLS) |
| `SUPABASE_URL` | server | SSR / functions |
| `SUPABASE_PUBLISHABLE_KEY` | server | Auth middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | Admin DB writes (Lovable Cloud managed) |
| `TELEGRAM_BOT_TOKEN` | **secret** | Bot API calls |
| `LOVABLE_API_KEY` | **secret** | AI Gateway (Smart CTA) |

Netlify path එක wire කරගන්න උවමනා නම් මේ 7-ම Netlify Site Settings → Environment variables යටතේ paste කරන්න. Service role key එක Lovable Cloud dashboard එකේන් copy කරගන්න ඕනේ.

---

## 🤖 Telegram Mini App Setup

1. BotFather (`@BotFather` Telegram) open කරන්න
2. `/mybots` → `teleMonix_bot` → **Bot Settings** → **Menu Button** → **Configure menu button**
3. URL: `https://telemonix.lovable.app/` (හෝ custom domain) — text: `Open TeleMonix`
4. `/newapp` හරි `/setdomain` හරි use කරලා Web App URL එකම set කරන්න
5. Webhook (one-time): admin panel එකේ **Re-register webhook** button click කරන්න (හෝ manual curl කරන්න — `/api/public/telegram/webhook`)

Mini-app open වෙන link එක: `https://t.me/teleMonix_bot?startapp`

---

## ✍️ Smart Tracking Links — User Guide

Message body එකේ tracking URL **සැඟවීමට** මේ syntax එක use කරන්න:

```
🎁 New offer just dropped — [Get Reward](https://example.com/signup) before it ends!
```

Reader ට පේන්නේ: **Get Reward** (blue underlined word). Click කරාම tracking system එක හරහා destination එකට යනවා. Views/clicks auto-count වෙනවා.

Inline button URL එකත් (පහළ "Open" button) automatic tracked — raw URL කිසිවෙකුට පේන්නේ නෑ.

---

## 📦 Tech Stack

- TanStack Start (React 19, Vite 7, SSR + server functions)
- Tailwind CSS v4
- Supabase (Lovable Cloud) — Postgres + RLS + Auth
- Lovable AI Gateway — Smart CTA suggestions (Gemini)
- Telegram Bot API — channel posting, member counts, webhook

## 📂 Key files

- `src/routes/index.tsx` — full mini-app UI (publisher, advertiser, admin)
- `src/lib/telegram.functions.ts` — all server functions
- `src/routes/api/public/telegram.webhook.ts` — bot webhook
- `src/routes/api/public/cron.distribute.ts` — ad distribution cron
- `src/routes/r.$code.ts` — short tracking link redirect
