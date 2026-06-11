import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const update = await request.json();
          const myChat = update.my_chat_member;
          if (myChat) {
            const chatId = String(myChat.chat?.id);
            const newStatus = myChat.new_chat_member?.status;
            const isRemoved = newStatus === "left" || newStatus === "kicked";
            if (isRemoved) {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const { data: ch } = await supabaseAdmin
                .from("telegram_channels").select("*").eq("chat_id", chatId).maybeSingle();
              if (ch) {
                await supabaseAdmin.from("telegram_channels").update({ status: "inactive" }).eq("id", ch.id);
                if (ch.owner_id) {
                  const { notifyBotRemoved } = await import("@/lib/telegram.functions");
                  await notifyBotRemoved(ch.owner_id, ch.title);
                }
              }
            } else if (newStatus === "administrator") {
              // bot promoted back -> mark pending again for review (or active if previously active)
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              await supabaseAdmin.from("telegram_channels").update({ status: "pending" }).eq("chat_id", chatId).eq("status", "inactive");
            }
          }
          return Response.json({ ok: true });
        } catch (e: any) {
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      },
    },
  },
});
