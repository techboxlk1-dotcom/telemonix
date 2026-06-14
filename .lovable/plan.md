# Plan — Netlify hosting, env vars, mini app, views, hidden tracking

## 1. Netlify deploy ඇත්තටම වැඩ කරවන්න

දැන් `gotelemonix.netlify.app` 404 — server functions (TanStack Start) Netlify එකේ run වෙන්න adapter එකක් ඕනේ. දැනට ඔයාගේ `netlify.toml` සරල SPA විදිහට පමණයි publish වෙන්නේ, ඒ නිසා `/`, `/r/:code`, `/api/public/*` කිසිවක් වැඩ කරන්නේ නෑ.

කරන්න යන දේවල්:
- `@netlify/vite-plugin-tanstack-start` (Netlify Start adapter) `bun add -d` කරලා `vite.config.ts` එකට plugin එක wire කරනවා.
- `netlify.toml` එක adapter එකට ගැලපෙන්න update — `publish = "dist/client"`, functions folder, `/api/*` → server function, SPA fallback අයින්.
- `public/_redirects` අයින් (adapter එකෙන් handle වෙනවා).
- Build command `bun run build`. Node 20.
- GitHub Pages workflow (`.github/workflows/static.yml`) අයින් — එක confuse වෙනවා, GH Pages මේ stack එකට වැඩ කරන්නේ නෑ.

## 2. Netlify Environment Variables (Site Settings → Environment variables)

මේ ටික **හරියටම** මේ නම් වලින් දාන්න:

Public (build-time):
- `VITE_SUPABASE_URL` = `https://ouxtjwgpttsqbbbvvfeo.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_-PDPqYz5dXtorTazvUW3cA_ZUaWpErT`
- `VITE_SUPABASE_PROJECT_ID` = `ouxtjwgpttsqbbbvvfeo`

Server-only (runtime, Functions scope):
- `SUPABASE_URL` = same URL
- `SUPABASE_PUBLISHABLE_KEY` = same publishable key
- `SUPABASE_SERVICE_ROLE_KEY` = **Lovable Cloud එකේ දැනට තියෙන service role key එක.** මේක Lovable Cloud managed නිසා ඔයාට Lovable Cloud dashboard එකෙන් copy කරගන්න ඕනේ (මට ඒක reveal කරන්න බෑ). Netlify එකට paste කරන්න.
- `TELEGRAM_BOT_TOKEN` = ඔයාගේ BotFather token
- `LOVABLE_API_KEY` = Lovable AI Gateway key (Smart CTA AI suggest එකට)

README + `.env.example` මේ list එකට update කරනවා.

## 3. Telegram Mini App වැඩ නොකරන එක

දැන් `t.me/teleMonix_bot?startapp` mini app open වෙන්නේ Lovable preview URL එකට. Netlify එකට move කරාට පස්සේ BotFather → `/setmenubutton` (හෝ `/newapp`) එකෙන් **Web App URL** `https://gotelemonix.netlify.app/` (පස්සේ custom domain) කියලා update කරන්න ඕනේ. මේක මම code එකෙන් කරන්න බෑ — ඔයා BotFather එකේ සකස් කරන්න. මම README එකේ step-by-step Sinhala instructions දානවා.

Webhook එකත් අලුත් domain එකට point කරන්න ඕනේ — admin panel එකේ "Re-register webhook" button එකක් දානවා, click කරාම අලුත් `https://<site>/api/public/telegram/webhook` URL එක Telegram එකට register වෙනවා.

## 4. Views count නිවැරදිව

දැනට views = max(views, clicks) කරලා approximate කරනවා. ඔයාට ඕනේ real per-channel view count.

Plan:
- Cron (every 10 min) server route එකකින් — recent `sent_messages` (last 7 days) walk කරලා Telegram Bot API `getMessageViews` analog නෑ. ඒ වෙනුවට `forwardMessage` සමග view counts available වෙන්නේ channel admin access එකේදී පමණයි.
- වඩාත් practical: bot එක channel එකේ admin නම් `editMessageReplyMarkup` call එකේ response එකේන් view count එනවා. ඒක capture කරලා `sent_messages.views` update කරනවා.
- Alternative: post එකේ button `/r/CODE` click කරාම unique visitors gauge වෙනවා — මේකම "Reach estimate" විදිහට display කරනවා.

මේ දෙකම implement කරනවා: real views (cron `getChat` + `editMessageReplyMarkup` workaround) + reach estimate (unique clicks × CTR factor).

## 5. Tracking link එක සැඟවීම (Hidden Smart Tracking)

දැන් problem: AI CTA suggest හරි, user වචනය හරි දාල save කරාම text එකේ raw `https://.../r/ABC` පේනවා.

හදන විදිහ:
- Composer එකේ "🔗 Smart link" field එකකට **destination URL** දාන්න (e.g. `https://example.com/signup`).
- "CTA text" field එකට AI suggest හෝ user වචනය (e.g. "🎁 Get Reward").
- Save කරනකොට backend `short_links` row එකක් හදනවා, ඊට පස්සේ Telegram message එකේ **inline keyboard button** එක විදිහට `[🎁 Get Reward](https://gotelemonix.netlify.app/r/ABC)` send කරනවා — text body එකේ raw URL කොහෙත්ම යන්නේ නෑ.
- Optional: message body එක ඇතුළේ user වචනයකට link එක embed කරන්න ඕනේ නම් Telegram MarkdownV2 `[🎁 Get Reward](https://.../r/ABC)` — display එකේ පේන්නේ වචනය විතරයි, tracking URL hidden.
- Preview component එකේත් මේ විදිහටම render කරනවා (button හෝ inline hyperlink — raw URL නෑ).

## 6. Scope split / order

1. Netlify adapter + toml + redirects cleanup + GH workflow delete
2. README + `.env.example` env-var guide (Sinhala steps)
3. Composer: destination URL + CTA text fields, hidden short-link generation, MarkdownV2 hyperlink rendering, preview update
4. Webhook re-register button + admin instructions
5. View-count cron job + reach estimate column

## Technical notes
- Netlify adapter: `@netlify/vite-plugin-tanstack-start` (current TanStack Start Netlify integration). Server functions deploy as Netlify Functions automatically; `/api/public/*` works as-is.
- `SUPABASE_SERVICE_ROLE_KEY` මට reveal කරන්න බෑ — Lovable Cloud → Project Settings → Backend → Secrets එකේන් copy කරගන්න.
- Telegram MarkdownV2 එකේ `.`, `-`, `!`, `(`, `)` escape කරන්න ඕනේ — helper එකක් `telegram.functions.ts` එකේ දැනටමත් තියෙනවා, reuse.
- Mini-app Web App URL change BotFather එකෙන් පමණයි කරන්න පුළුවන් — automated කරන්න බෑ.

## මගෙන් confirm එකක්
මේ plan එක okද, නැත්නම් මුලින්ම Netlify + env vars + hidden tracking (1, 2, 3, 4) පමණක්ම මේ turn එකේ ගහලා, view-count cron (5) වෙනම turn එකකට තියන්නද?
