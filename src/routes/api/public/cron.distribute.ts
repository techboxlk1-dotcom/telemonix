import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/distribute")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const origin = `${url.protocol}//${url.host}`;
          const { distributeAds } = await import("@/lib/telegram.functions");
          const r = await (distributeAds as any)({ data: { siteOrigin: origin } });
          return Response.json({ ok: true, ...r });
        } catch (e: any) {
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      },
      GET: async ({ request }) => {
        // allow GET trigger for manual ping
        try {
          const url = new URL(request.url);
          const origin = `${url.protocol}//${url.host}`;
          const { distributeAds } = await import("@/lib/telegram.functions");
          const r = await (distributeAds as any)({ data: { siteOrigin: origin } });
          return Response.json({ ok: true, ...r });
        } catch (e: any) {
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      },
    },
  },
});
