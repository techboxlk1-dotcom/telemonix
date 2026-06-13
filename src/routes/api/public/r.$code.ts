import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/r/$code")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: link } = await supabaseAdmin
          .from("short_links").select("*").eq("code", params.code).maybeSingle();
        if (!link) return new Response("Not found", { status: 404 });

        const url = new URL(request.url);
        const u = url.searchParams.get("u");
        const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0";
        const ua = request.headers.get("user-agent") || "";
        const { createHash } = await import("crypto");
        const synthUid = u || BigInt("0x" + createHash("sha1").update(ip + "|" + ua).digest("hex").slice(0, 12)).toString();

        try {
          if (link.kind === "ad") {
            const { recordAdClick } = await import("@/lib/telegram.functions");
            const r = await recordAdClick(link.ref_id, synthUid, link.src as "button" | "link");
            const target = link.src === "link" ? link.target_url : (r?.url || link.target_url);
            if (!target) return new Response("Not found", { status: 404 });
            return new Response(null, { status: 302, headers: { Location: target } });
          }
          const { recordPostClick } = await import("@/lib/telegram.functions");
          const r = await recordPostClick(link.ref_id, synthUid, link.src as "button" | "link", link.target_url);
          if (!r?.url) return new Response("Not found", { status: 404 });
          return new Response(null, { status: 302, headers: { Location: r.url } });
        } catch (e: any) {
          return new Response("Error: " + e.message, { status: 500 });
        }
      },
    },
  },
});
