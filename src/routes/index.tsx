import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast, Toaster } from "sonner";
import { Send, Plus, Trash2, Image as ImageIcon, X, Save, Pencil, FileText } from "lucide-react";
import {
  addChannel, listChannels, deleteChannel, broadcast,
  listPosts, savePost, deletePost,
} from "@/lib/telegram.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Postmaster — Telegram Broadcaster" },
      { name: "description", content: "Broadcast posts with image and button to all your Telegram channels via @Postmaster21Bot." },
    ],
  }),
  component: Index,
});

const BUTTON_COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#10b981" },
  { name: "Red", value: "#ef4444" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Orange", value: "#f59e0b" },
  { name: "Pink", value: "#ec4899" },
];

function Index() {
  const qc = useQueryClient();
  const listFn = useServerFn(listChannels);
  const addFn = useServerFn(addChannel);
  const delFn = useServerFn(deleteChannel);
  const sendFn = useServerFn(broadcast);
  const listPostsFn = useServerFn(listPosts);
  const savePostFn = useServerFn(savePost);
  const delPostFn = useServerFn(deletePost);

  const { data: channels = [] } = useQuery({ queryKey: ["channels"], queryFn: () => listFn() });
  const { data: posts = [] } = useQuery({ queryKey: ["posts"], queryFn: () => listPostsFn() });

  const [tab, setTab] = useState("compose");
  const [chatInput, setChatInput] = useState("");
  const addMut = useMutation({
    mutationFn: (chat: string) => addFn({ data: { chat } }),
    onSuccess: () => { toast.success("Channel added"); setChatInput(""); qc.invalidateQueries({ queryKey: ["channels"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels"] }),
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [buttonColor, setButtonColor] = useState(BUTTON_COLORS[0].value);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setEditId(null); setText(""); setImageBase64(null); setImagePreview(null);
    setButtonText(""); setButtonUrl(""); setButtonColor(BUTTON_COLORS[0].value);
    if (fileRef.current) fileRef.current.value = "";
  };

  const loadPost = (p: any) => {
    setEditId(p.id);
    setText(p.text || "");
    setImageBase64(p.image_base64 || null);
    setImagePreview(p.image_base64 || null);
    setButtonText(p.button_text || "");
    setButtonUrl(p.button_url || "");
    setButtonColor(p.button_color || BUTTON_COLORS[0].value);
    setTab("compose");
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { setImageBase64(r.result as string); setImagePreview(r.result as string); };
    r.readAsDataURL(f);
  };

  const sendMut = useMutation({
    mutationFn: () => sendFn({ data: { text, imageBase64, buttonText: buttonText || null, buttonUrl: buttonUrl || null } }),
    onSuccess: (res) => {
      const ok = res.results.filter((r) => r.ok).length;
      const failed = res.results.filter((r) => !r.ok);
      if (failed.length === 0) toast.success(`Sent to ${ok} channel${ok === 1 ? "" : "s"}`);
      else {
        const first = failed[0];
        toast.error(`Sent: ${ok} · Failed: ${failed.length}. ${first.chat_id}: ${first.error}`, { duration: 10000 });
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveMut = useMutation({
    mutationFn: () => savePostFn({ data: { id: editId, text, imageBase64, buttonText: buttonText || null, buttonUrl: buttonUrl || null, buttonColor } }),
    onSuccess: (row: any) => {
      toast.success(editId ? "Post updated" : "Post saved");
      setEditId(row.id);
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delPostMut = useMutation({
    mutationFn: (id: string) => delPostFn({ data: { id } }),
    onSuccess: (_d, id) => {
      toast.success("Deleted");
      if (editId === id) resetForm();
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const hasContent = text.trim().length > 0 || imageBase64;
  const canSend = hasContent && channels.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 pb-20">
      <Toaster position="top-center" richColors />

      <header className="sticky top-0 z-10 backdrop-blur-md bg-background/70 border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Postmaster</h1>
            <p className="text-xs text-muted-foreground">@Postmaster21Bot</p>
          </div>
          <Badge variant="secondary">{channels.length} channel{channels.length === 1 ? "" : "s"}</Badge>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="saved">Saved {posts.length > 0 && <span className="ml-1 text-xs opacity-70">({posts.length})</span>}</TabsTrigger>
            <TabsTrigger value="channels">Channels</TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4 mt-4">
            {editId && (
              <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted text-xs">
                <span>Editing saved post</span>
                <Button size="sm" variant="ghost" onClick={resetForm}>New</Button>
              </div>
            )}
            <Card>
              <CardHeader><CardTitle className="text-base">Message</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {imagePreview ? (
                  <div className="relative rounded-lg overflow-hidden border">
                    <img src={imagePreview} alt="" className="w-full max-h-80 object-cover" />
                    <button
                      onClick={() => { setImageBase64(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                      className="absolute top-2 right-2 bg-background/80 rounded-full p-1.5 hover:bg-background"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed rounded-lg py-8 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted/50 transition"
                  >
                    <ImageIcon className="h-6 w-6" />
                    <span className="text-sm">Add image (optional)</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0] || null)} />

                <Textarea
                  placeholder="Write your message... HTML allowed (<b>, <i>, <a>)"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Button (optional)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Text</Label>
                    <Input placeholder="Open" value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">URL</Label>
                    <Input placeholder="https://..." value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Color (preview only — Telegram uses its theme)</Label>
                  <div className="flex gap-2 flex-wrap">
                    {BUTTON_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setButtonColor(c.value)}
                        className={`h-8 w-8 rounded-full border-2 transition ${buttonColor === c.value ? "ring-2 ring-offset-2 ring-foreground" : "border-transparent"}`}
                        style={{ background: c.value }}
                        aria-label={c.name}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {(text || imagePreview || buttonText) && (
              <Card>
                <CardHeader><CardTitle className="text-base">Preview</CardTitle></CardHeader>
                <CardContent>
                  <div className="rounded-lg border bg-card p-3 max-w-sm">
                    {imagePreview && <img src={imagePreview} alt="" className="rounded-md mb-2 w-full" />}
                    {text && <p className="text-sm whitespace-pre-wrap mb-2" dangerouslySetInnerHTML={{ __html: text }} />}
                    {buttonText && buttonUrl && (
                      <button
                        className="w-full py-2 rounded-md text-white font-medium text-sm"
                        style={{ background: buttonColor }}
                      >
                        {buttonText}
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="lg"
                disabled={!hasContent || saveMut.isPending}
                onClick={() => saveMut.mutate()}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMut.isPending ? "Saving..." : editId ? "Update" : "Save"}
              </Button>
              <Button
                size="lg"
                disabled={!canSend || sendMut.isPending}
                onClick={() => sendMut.mutate()}
              >
                <Send className="h-4 w-4 mr-2" />
                {sendMut.isPending ? "Sending..." : "Send"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="saved" className="space-y-3 mt-4">
            {posts.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No saved posts yet</p>
              </div>
            )}
            {posts.map((p: any) => (
              <Card key={p.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex gap-3">
                    {p.image_base64 && (
                      <img src={p.image_base64} alt="" className="h-16 w-16 rounded-md object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm line-clamp-3 break-words">{p.text || <span className="italic text-muted-foreground">(no text)</span>}</p>
                      {p.button_text && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">🔘 {p.button_text} → {p.button_url}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm" variant="default" className="flex-1"
                      disabled={channels.length === 0 || sendMut.isPending}
                      onClick={() => {
                        loadPost(p);
                        setTimeout(() => sendMut.mutate(), 0);
                      }}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" /> Send
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => loadPost(p)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => delPostMut.mutate(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="channels" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Add channel</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  First make <b>@Postmaster21Bot</b> an admin in the channel. Then enter the channel username or link.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="@mychannel or t.me/mychannel"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && chatInput && addMut.mutate(chatInput)}
                  />
                  <Button onClick={() => addMut.mutate(chatInput)} disabled={!chatInput || addMut.isPending}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {channels.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No channels yet</p>
              )}
              {channels.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.username ? `@${c.username}` : c.chat_id}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => delMut.mutate(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
