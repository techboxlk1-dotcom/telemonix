# TeleMonix Pro Upgrade Plan

ඔයාගේ requirements ගොඩක් වැඩි. මම මේක phases 5 කට කඩලා හදනවා. එක එක phase එක ඉවර වුණාම review කරන්න පුළුවන්. මුලින් plan එක confirm කරන්න.

## Phase 1 — Foundations & Branding

- **Logo:** ඔයා upload කරපු TeleMonix logo එක replace කරනවා (`src/assets/telemonix-logo.png`).
- **Splash + Dashboard picker:** Mini app open වෙද්දි සෑම වතාවකම logo splash → mode picker dashboard (Publisher / Advertiser) පෙන්වනවා, mini app විස්තර + ad network features ඇතුළත්ව. Selection පස්සේ තමයි role tabs ඔපන් වෙන්නේ. Top-bar එකේ mode switcher.
- **Design refresh:** Glassmorphism + gradient cards, animated banners, color-coded badges, larger typography, section headers, professional fintech look.
- **GitHub/Netlify compat:** `netlify.toml` + SPA fallback, `_redirects`, README, build script. (TanStack Start server functions → Netlify Functions adapter explanation: server routes need Netlify/Cloudflare adapter — මම Netlify adapter wire කරනවා. GitHub repo වලට fit වෙන්න `.gitignore`, env example file එකක්.)

## Phase 2 — Tracking & Counting Engine (the core bug fixes)

- **Admin posts send 0 bug:** sender flow එක debug කරලා fix කරනවා (current issue: send count 0). Send → DB write → progress refresh wire properly.
- **Preview pane:** Admin post + Advertiser ad create flow වල live Telegram-style preview card (image, text, button) පෙන්වනවා.
- **Per-user click dedup:** `ad_clicks` (user_id, ad_id, source) unique table. Button click 1× + link click 1× = ONE click counted per user per ad. Already-clicked = no count. Auto-applied for both buttons සහ message links (link rewriting: text එකේ http(s) URLs auto-replace කරනවා tracker URLs වලට).
- **Admin post tracking එකත් same:** CPM + CPC fields admin post compose එකේ. Watermark default ON, admin post එකේ විතරක් remove toggle. Ad posts වල watermark force ON.
- **Auto bot/API view+click counting:** scheduled cron (every 5 min) — channel post views Telegram API (`forwardMessages` + `getChat` member-count + click ratio formula in your VR algorithm) භාවිතා කරලා estimate update + recorded clicks atomic. Value → publisher earnings auto-credit (admin posts: admin defined CPM/CPC × 65%; ad posts: advertiser CPM/CPC × 65%).
- **Auto-credit publisher balances** to `profiles.publisher_balance_usd` + `earnings_ledger` rows.

## Phase 3 — Wallets, Deposit & Withdraw

- **Advertiser:** Deposit-only tab. Public side: Withdraw-only.
- **Deposit page:**
  - USDT BEP20: `0x082679f6cD88A25a17b58979AC72a500b1Aa1b9c`
  - TRX TRC20: `THK7E2wEz6SjakNM3Z7jigJdU9ixKJPDEo`
  - TON: `UQA3agalrvn_PYTiVYvaS55qthZFxnLrjQm0tUNb2lQ3A9pL`
  - Min $5. Live price (CoinGecko API) → user enters USD, shows token amount.
  - Auto-confirm: on-chain watcher (BSC/Tron/TON public RPCs) checks deposit address for incoming tx matching `(amount ± tolerance, memo/tag = user_id short code)`. Confirmed → balance add → notification. Cron every 2 min.
- **Withdraw:** USDT BEP20, TRX TRC20, TON (memo optional). Min $10. History list. Status: pending / approved / paid / rejected. Admin approve manually first; auto-payout toggle later.
- **Withdraw history + Deposit history** for user.

## Phase 4 — Admin Pro Dashboard

Dedicated admin (chat 5419054691) section with sidebar-style tabs:

1. **Overview** — total earnings, users, active ads, views, clicks, pending withdrawals, charts.
2. **Users** — list, balances, total clicks/views, quality score, ban/reset/credit-balance. **Direct message + add balance** to any user.
3. **Channels** — admin-added channel list, remove channel, set per-channel CPM/CPC override (overrides the 65% default).
4. **Ads Manager** — review, approve, pause, edit ads. Targeting filters.
5. **Channel Stats** — per channel: posts sent, views, clicks, CPM, CPC, revenue. Separate tab.
6. **Withdraw Management** — pending/approved/paid/rejected, approve/reject/mark paid, Telegram notification to user.
7. **Deposit Management** — auto/manual confirm, history.
8. **Analytics** — CPM/CPC per channel, top channels, fraud detection (duplicate IP, fast clicks).
9. **Settings** — default CPM, CPC, min withdraw, fraud level, watermark default.

Admin gets Telegram notifications: new withdraw, new deposit, fraud alert, daily summary.

## Phase 5 — Ad Engine, Targeting, FAQ

- **Channel add:** country + language + category selectors. Min 200K subscribers enforcement (validation message). Admin guidance image (the Telegram "Add Bot as Admin / Manage Messages" screenshot ඔයා upload කරපුව) + step-by-step guide pop-up.
- **Channel & Ad pending message:** user adds channel → bot DMs user the promo post (NOT to channel). DM result shown in UI.
- **Ad targeting:** country + language + category. Distribution engine matches only eligible channels.
- **48-hour fallback:** if ad target views not reached in 48h, expand to other channels (drop targeting).
- **Auto error recovery:** retry queue for failed Telegram API calls (exponential backoff). Error logs visible in admin.
- **Referral link fix:** `https://t.me/teleMonix_bot?startapp=ref_<code>`.
- **FAQ tab** for both publisher & advertiser modes — full guide including monetization, deposit/withdraw, CPM/CPC explanation (your Sinhala explanation reused).
- **Analytics for users:** per-channel CPM, CPC, clicks, views shown to publisher.

---

## Technical notes (for me, not user-facing)

- New tables: `ad_clicks` (dedup), `deposits`, `withdrawals`, `channel_stats`, `admin_messages`, `error_log`.
- Alter `telegram_channels`: `country`, `language`, `cpm_override`, `cpc_override`, `subscribers_count`.
- Alter `ad_campaigns`: `country[]`, `language[]`, `cpc_rate`, expanded_at.
- Alter `sent_messages`: add `cpm`, `cpc`, `watermark`, dedup-aware counters.
- Cron jobs (pg_cron): distribute (5m), view-sync (5m), deposit-watcher (2m), withdraw-notify (5m), expand-targeting (1h).
- Link rewriting in messages: regex extract URLs → store mapping → replace with tracker URLs before send.
- Netlify deploy: add adapter, build config, document GitHub workflow.

---

## Questions

1. **Auto deposit confirmation** needs blockchain RPC access — BSCScan API key, TronGrid key, TonAPI key. ඔයාට මේවා දාන්න පුළුවන්ද, නැතිනම් free public endpoints (rate-limited) use කරන්නද? Free OK කිව්වොත් මම free use කරනවා, පස්සේ keys add කරන්න පුළුවන්.
2. **GitHub/Netlify:** ඔයාට මේක දැනට Lovable hosting වෙනුවට Netlify වලට move කරන්න ඕනේද, නැතිනම් just compatibility (Lovable තවම main, Netlify backup option)?
3. **200K subscribers minimum** strict block කරන්නද, නැතිනම් warning + admin override?
4. **Auto-payout** withdraw — manual approval only (Phase 1), auto-payout later wire? Confirm.

Confirm කරාම මම phase order එකේ build කරන්න පටන් ගන්නවා. ඔක්කොම එක මැසේජ් එකකින් කරන්න බෑ — 5 large passes වෙයි.
