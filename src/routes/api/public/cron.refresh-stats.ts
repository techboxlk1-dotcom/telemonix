import { createFileRoute } from "@tanstack/react-router";

// Telegram Bot API does NOT expose channel post views (MTProto only).
// We estimate views via time-decay × channel members_count, floored at unique_clicks,
// and refresh channel members_count from getChat at the same time. Real clicks are exact.
const TG_API = "https://api.telegram.org";

function token() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN missing");
  return t;
}

// view-decay curve (fraction of members likely to have seen post by `hours`)
function viewFactor(hours: number): number {
  if (hours < 0.25) return 0.10;
  if (hours < 1)    return 0.25;
  if (hours < 3)    return 0.40;
  if (hours < 6)    return 0.55;
  if (hours < 24)   return 0.70;
  if (hours < 72)   return 0.85;
  return 0.92;
}

async function tg(method: string, body: any) {
  const r = await fetch(`${TG_API}/bot${token()}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return r.json();
}

async function refresh() {
  const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");

  // 1) Refresh members_count for active channels (cache via Map)
  const { data: chans } = await sb.from("telegram_channels").select("id, chat_id, status").eq("status", "active");
  const memberMap = new Map<string, number>();
  for (const ch of chans ?? []) {
    try {
      const r = await tg("getChatMemberCount", { chat_id: ch.chat_id });
      if (r.ok) {
        memberMap.set(ch.id, r.result);
        await sb.from("telegram_channels").update({ members_count: r.result }).eq("id", ch.id);
      }
    } catch {}
  }

  // 2) Refresh sent_messages views (last 7 days)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: msgs } = await sb.from("sent_messages")
    .select("id, channel_id, sent_at, unique_clicks, views")
    .gte("sent_at", since);
  let touched = 0;
  for (const m of msgs ?? []) {
    if (!m.channel_id) continue;
    const members = memberMap.get(m.channel_id) || 0;
    if (!members) continue;
    const hours = (Date.now() - new Date(m.sent_at).getTime()) / 3600000;
    const estimated = Math.floor(members * viewFactor(hours));
    const next = Math.max(estimated, m.unique_clicks || 0, m.views || 0);
    if (next !== m.views) {
      await sb.from("sent_messages").update({ views: next }).eq("id", m.id);
      touched++;
    }
  }

  // 3) Refresh ad_placements views (active ads)
  const { data: placements } = await sb.from("ad_placements")
    .select("id, channel_id, sent_at, unique_clicks, views, campaign_id")
    .gte("sent_at", since);
  for (const p of placements ?? []) {
    if (!p.channel_id) continue;
    const members = memberMap.get(p.channel_id) || 0;
    if (!members) continue;
    const hours = (Date.now() - new Date(p.sent_at).getTime()) / 3600000;
    const estimated = Math.floor(members * viewFactor(hours));
    const next = Math.max(estimated, p.unique_clicks || 0, p.views || 0);
    if (next !== p.views) {
      await sb.from("ad_placements").update({ views: next }).eq("id", p.id);
    }
  }

  // 4) Aggregate ad_campaigns views_count from placements
  const { data: camps } = await sb.from("ad_campaigns").select("id, status, target_views, target_clicks").eq("status", "active");
  for (const c of camps ?? []) {
    const { data: ps } = await sb.from("ad_placements").select("views, unique_clicks").eq("campaign_id", c.id);
    const totalViews = (ps ?? []).reduce((s, r: any) => s + (r.views || 0), 0);
    const totalClicks = (ps ?? []).reduce((s, r: any) => s + (r.unique_clicks || 0), 0);
    const done = totalViews >= c.target_views && totalClicks >= c.target_clicks;
    await sb.from("ad_campaigns").update({
      views_count: totalViews,
      ...(done ? { status: "complete", completed_at: new Date().toISOString() } : {}),
    }).eq("id", c.id);
  }

  return { channelsRefreshed: memberMap.size, messagesTouched: touched, placementsChecked: (placements ?? []).length };
}

export const Route = createFileRoute("/api/public/cron/refresh-stats")({
  server: {
    handlers: {
      GET: async () => {
        try { return Response.json({ ok: true, ...(await refresh()) }); }
        catch (e: any) { return Response.json({ ok: false, error: e.message }, { status: 500 }); }
      },
      POST: async () => {
        try { return Response.json({ ok: true, ...(await refresh()) }); }
        catch (e: any) { return Response.json({ ok: false, error: e.message }, { status: 500 }); }
      },
    },
  },
});
