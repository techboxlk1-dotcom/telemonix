import { createServerFn } from "@tanstack/react-start";
import { createHmac } from "crypto";

const TG_API = "https://api.telegram.org";
const ADMIN_ID = 5419054691;

function token() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN missing");
  return t;
}

async function tg(method: string, body: any) {
  const res = await fetch(`${TG_API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type TgUser = { id: number; username?: string; first_name?: string; last_name?: string; photo_url?: string };

function parseInitData(initData: string): { user: TgUser; valid: boolean } | null {
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");
    const pairs: string[] = [];
    Array.from(params.keys()).sort().forEach((k) => pairs.push(`${k}=${params.get(k)}`));
    const dcs = pairs.join("\n");
    const secret = createHmac("sha256", "WebAppData").update(token()).digest();
    const expected = createHmac("sha256", secret).update(dcs).digest("hex");
    const valid = expected === hash;
    const userJson = params.get("user");
    if (!userJson) return null;
    const user = JSON.parse(userJson) as TgUser;
    return { user, valid };
  } catch {
    return null;
  }
}

function resolveUser(initData?: string | null, devUid?: number | null): { user: TgUser; valid: boolean } {
  const parsed = initData ? parseInitData(initData) : null;
  if (parsed?.valid) return parsed;
  const id = devUid || ADMIN_ID;
  return { user: { id, first_name: id === ADMIN_ID ? "Admin" : "User" }, valid: false };
}

async function upsertProfile(u: TgUser) {
  const sb = await getAdmin();
  await sb.from("profiles").upsert({
    telegram_user_id: u.id,
    username: u.username || null,
    first_name: u.first_name || null,
    last_name: u.last_name || null,
    photo_url: u.photo_url || null,
  }, { onConflict: "telegram_user_id" });
}

async function getCpm(): Promise<number> {
  const sb = await getAdmin();
  const { data } = await sb.from("app_settings").select("value_num").eq("key", "cpm_usd").maybeSingle();
  return Number(data?.value_num ?? 1);
}

export const getMe = createServerFn({ method: "POST" })
  .inputValidator((d: { initData?: string; devUid?: number }) => d)
  .handler(async ({ data }) => {
    const { user } = resolveUser(data.initData, data.devUid);
    await upsertProfile(user);
    const sb = await getAdmin();
    const { data: profile } = await sb.from("profiles").select("*").eq("telegram_user_id", user.id).single();
    const isAdmin = user.id === ADMIN_ID;
    const { data: channels } = await sb.from("telegram_channels").select("id, members_count").eq("owner_id", user.id);
    const channelCount = channels?.length ?? 0;
    const totalMembers = (channels ?? []).reduce((s, c: any) => s + (c.members_count || 0), 0);
    const { data: msgs } = await sb.from("sent_messages").select("views").eq("owner_id", user.id);
    const postCount = msgs?.length ?? 0;
    const totalViews = (msgs ?? []).reduce((s, m: any) => s + (m.views || 0), 0);
    const cpm = await getCpm();
    const earned = +((totalViews / 1000) * cpm).toFixed(4);
    return { user, isAdmin, profile, cpm, stats: { channelCount, totalMembers, postCount, totalViews, earned } };
  });

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await getAdmin();
  const { data } = await sb.from("app_settings").select("*");
  const map: Record<string, any> = {};
  (data ?? []).forEach((r: any) => { map[r.key] = r.value_num ?? r.value_text; });
  return { cpm_usd: Number(map.cpm_usd ?? 1) };
});

export const setCpm = createServerFn({ method: "POST" })
  .inputValidator((d: { cpm: number; initData?: string; devUid?: number }) => d)
  .handler(async ({ data }) => {
    const { user } = resolveUser(data.initData, data.devUid);
    if (user.id !== ADMIN_ID) throw new Error("Forbidden");
    const cpm = Math.max(0.8, Math.min(1, Number(data.cpm)));
    const sb = await getAdmin();
    await sb.from("app_settings").upsert({ key: "cpm_usd", value_num: cpm, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return { cpm };
  });

export const syncViews = createServerFn({ method: "POST" })
  .inputValidator((d: { initData?: string; devUid?: number }) => d)
  .handler(async ({ data }) => {
    // Telegram Bot API doesn't expose post view counts. We estimate using
    // member counts of the destination channel (typical organic reach proxy)
    // and never lower an existing higher count (e.g. real click counts).
    const { user } = resolveUser(data.initData, data.devUid);
    const isAdmin = user.id === ADMIN_ID;
    const sb = await getAdmin();
    let q = sb.from("sent_messages").select("id, channel_id, views, clicks, owner_id");
    if (!isAdmin) q = q.eq("owner_id", user.id);
    const { data: rows } = await q;
    if (!rows?.length) return { updated: 0 };
    const channelIds = Array.from(new Set(rows.map((r: any) => r.channel_id).filter(Boolean)));
    const { data: chs } = await sb.from("telegram_channels").select("id, members_count").in("id", channelIds);
    const memberMap: Record<string, number> = {};
    (chs ?? []).forEach((c: any) => { memberMap[c.id] = c.members_count || 0; });
    let updated = 0;
    for (const r of rows as any[]) {
      const est = Math.max(r.views || 0, r.clicks || 0, memberMap[r.channel_id] || 0);
      if (est !== r.views) {
        await sb.from("sent_messages").update({ views: est }).eq("id", r.id);
        updated++;
      }
    }
    return { updated };
  });

export const addChannel = createServerFn({ method: "POST" })
  .inputValidator((d: { chat: string; initData?: string; devUid?: number }) => d)
  .handler(async ({ data }) => {
    const { user } = resolveUser(data.initData, data.devUid);
    await upsertProfile(user);

    let chatRef = data.chat.trim();
    if (chatRef.startsWith("https://t.me/")) chatRef = chatRef.replace("https://t.me/", "");
    if (chatRef.startsWith("t.me/")) chatRef = chatRef.replace("t.me/", "");
    if (!chatRef.startsWith("@") && !chatRef.startsWith("-") && isNaN(Number(chatRef))) {
      chatRef = "@" + chatRef;
    }

    const info = await tg("getChat", { chat_id: chatRef });
    if (!info.ok) throw new Error(info.description || "Could not find channel. Add the bot as admin first.");

    const me = await tg("getMe", {});
    if (!me.ok) throw new Error(me.description || "Bot token invalid");
    const member = await tg("getChatMember", { chat_id: info.result.id, user_id: me.result.id });
    if (!member.ok) throw new Error(member.description || "Add @Postmaster21Bot to the channel first.");
    const status = member.result?.status;
    if (status !== "administrator" && status !== "creator") {
      throw new Error("Bot is not an admin in this channel. Make @Postmaster21Bot an admin first.");
    }

    const count = await tg("getChatMemberCount", { chat_id: info.result.id });
    const members = count.ok ? count.result : 0;

    const sb = await getAdmin();
    const { data: row, error } = await sb
      .from("telegram_channels")
      .upsert({
        chat_id: String(info.result.id),
        title: info.result.title || info.result.username || "Channel",
        username: info.result.username || null,
        owner_id: user.id,
        members_count: members,
      }, { onConflict: "chat_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listChannels = createServerFn({ method: "POST" })
  .inputValidator((d: { initData?: string; devUid?: number }) => d)
  .handler(async ({ data }) => {
    const { user } = resolveUser(data.initData, data.devUid);
    const isAdmin = user.id === ADMIN_ID;
    const sb = await getAdmin();
    let q = sb.from("telegram_channels").select("*").order("created_at", { ascending: false });
    if (!isAdmin) q = q.eq("owner_id", user.id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r: any) => r.id);
    let counts: Record<string, { posts: number; views: number }> = {};
    if (ids.length) {
      const { data: msgs } = await sb.from("sent_messages").select("channel_id, views").in("channel_id", ids);
      (msgs ?? []).forEach((m: any) => {
        const k = m.channel_id;
        if (!counts[k]) counts[k] = { posts: 0, views: 0 };
        counts[k].posts += 1;
        counts[k].views += m.views || 0;
      });
    }
    return (rows ?? []).map((r: any) => ({ ...r, posts: counts[r.id]?.posts || 0, views: counts[r.id]?.views || 0 }));
  });

export const deleteChannel = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; initData?: string; devUid?: number }) => d)
  .handler(async ({ data }) => {
    const { user } = resolveUser(data.initData, data.devUid);
    const isAdmin = user.id === ADMIN_ID;
    const sb = await getAdmin();
    let q = sb.from("telegram_channels").delete().eq("id", data.id);
    if (!isAdmin) q = q.eq("owner_id", user.id);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const broadcast = createServerFn({ method: "POST" })
  .inputValidator((d: {
    text: string;
    imageBase64?: string | null;
    buttonText?: string | null;
    buttonUrl?: string | null;
    channelIds?: string[];
    siteOrigin?: string;
    initData?: string;
    devUid?: number;
  }) => d)
  .handler(async ({ data }) => {
    const { user } = resolveUser(data.initData, data.devUid);
    const isAdmin = user.id === ADMIN_ID;
    const sb = await getAdmin();
    let q = sb.from("telegram_channels").select("*");
    if (!isAdmin) q = q.eq("owner_id", user.id);
    if (data.channelIds && data.channelIds.length) q = q.in("id", data.channelIds);
    const { data: channels, error } = await q;
    if (error) throw new Error(error.message);
    if (!channels?.length) throw new Error("No channels selected.");

    const origin = (data.siteOrigin || "").replace(/\/$/, "");
    const results: { chat_id: string; ok: boolean; error?: string }[] = [];

    for (const ch of channels) {
      try {
        // Pre-insert sent_messages row so the button URL can carry its id
        let trackingUrl: string | null = null;
        let preRow: any = null;
        if (data.buttonText && data.buttonUrl && origin) {
          const { data: ins } = await sb.from("sent_messages").insert({
            owner_id: ch.owner_id || user.id,
            channel_id: ch.id,
            chat_id: ch.chat_id,
            text: data.text || null,
            button_url: data.buttonUrl,
          }).select().single();
          preRow = ins;
          if (ins) trackingUrl = `${origin}/api/public/t/${ins.id}`;
        }

        const reply_markup = data.buttonText && data.buttonUrl
          ? { inline_keyboard: [[{ text: data.buttonText, url: trackingUrl || data.buttonUrl }]] }
          : undefined;

        let resp: any;
        if (data.imageBase64) {
          const b64 = data.imageBase64.includes(",") ? data.imageBase64.split(",")[1] : data.imageBase64;
          const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const fd = new FormData();
          fd.append("chat_id", ch.chat_id);
          fd.append("caption", data.text || "");
          fd.append("parse_mode", "HTML");
          if (reply_markup) fd.append("reply_markup", JSON.stringify(reply_markup));
          fd.append("photo", new Blob([bin], { type: "image/jpeg" }), "image.jpg");
          const r = await fetch(`${TG_API}/bot${token()}/sendPhoto`, { method: "POST", body: fd });
          resp = await r.json();
        } else {
          resp = await tg("sendMessage", {
            chat_id: ch.chat_id,
            text: data.text,
            parse_mode: "HTML",
            reply_markup,
          });
        }
        const ok = !!resp.ok;
        if (ok) {
          if (preRow) {
            await sb.from("sent_messages").update({ message_id: resp.result?.message_id || null }).eq("id", preRow.id);
          } else {
            await sb.from("sent_messages").insert({
              owner_id: ch.owner_id || user.id,
              channel_id: ch.id,
              chat_id: ch.chat_id,
              message_id: resp.result?.message_id || null,
              text: data.text || null,
              button_url: data.buttonUrl || null,
            });
          }
        } else if (preRow) {
          await sb.from("sent_messages").delete().eq("id", preRow.id);
        }
        results.push({ chat_id: ch.chat_id, ok, error: ok ? undefined : resp.description });
      } catch (e: any) {
        results.push({ chat_id: ch.chat_id, ok: false, error: e.message });
      }
    }
    return { results };
  });

export const listPosts = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await getAdmin();
  const { data, error } = await sb.from("saved_posts").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const savePost = createServerFn({ method: "POST" })
  .inputValidator((d: {
    id?: string | null;
    text: string;
    imageBase64?: string | null;
    buttonText?: string | null;
    buttonUrl?: string | null;
    buttonColor?: string | null;
  }) => d)
  .handler(async ({ data }) => {
    const sb = await getAdmin();
    const payload = {
      text: data.text || "",
      image_base64: data.imageBase64 || null,
      button_text: data.buttonText || null,
      button_url: data.buttonUrl || null,
      button_color: data.buttonColor || null,
    };
    if (data.id) {
      const { data: row, error } = await sb.from("saved_posts").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await sb.from("saved_posts").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePost = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const sb = await getAdmin();
    const { error } = await sb.from("saved_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
