import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Send, Trash2, MessageCircle, LogIn } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export default function Chat() {
  const { user, isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const dateLocale = language === "fr" ? fr : enUS;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) setMessages(data as ChatMessage[]);
      setLoading(false);
    };
    fetchMessages();
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("chat-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    setSending(true);
    const userName =
      user.user_metadata?.full_name || user.email?.split("@")[0] || "Anonyme";

    const { error } = await supabase.from("chat_messages").insert({
      user_id: user.id,
      user_name: userName,
      content: newMessage.trim().slice(0, 500),
    });

    if (error) {
      toast.error(t("chat.error"));
    } else {
      setNewMessage("");
    }
    setSending(false);
  };

  const handleDelete = async (messageId: string) => {
    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .eq("id", messageId);
    if (!error) {
      toast.success(t("chat.deleted"));
    }
  };

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{t("chat.title")}</span>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-2">
            {t("chat.title")}
          </h1>
          <p className="text-muted-foreground">{t("chat.subtitle")}</p>
        </div>

        {/* Chat container */}
        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col" style={{ height: "60vh" }}>
          {/* Messages area */}
          <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-muted-foreground">...</div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-center">
                <div>
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>{t("chat.empty")}</p>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.user_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-3 group",
                      isOwn && "flex-row-reverse"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm",
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      )}
                    >
                      {!isOwn && (
                        <p className="text-xs font-semibold mb-1 text-primary">
                          {msg.user_name}
                        </p>
                      )}
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                        {msg.content}
                      </p>
                      <p
                        className={cn(
                          "text-[10px] mt-1",
                          isOwn
                            ? "text-primary-foreground/60"
                            : "text-muted-foreground"
                        )}
                      >
                        {format(new Date(msg.created_at), "HH:mm · d MMM", {
                          locale: dateLocale,
                        })}
                      </p>
                    </div>
                    {(isOwn || isAdmin) && (
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="opacity-0 group-hover:opacity-100 self-center transition-opacity text-destructive/60 hover:text-destructive"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-border p-3 bg-background">
            {user ? (
              <form onSubmit={handleSend} className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={t("chat.placeholder")}
                  maxLength={500}
                  className="flex-1"
                  disabled={sending}
                />
                <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground mb-2">{t("chat.login")}</p>
                <Link to="/auth">
                  <Button variant="outline" size="sm" className="gap-2">
                    <LogIn className="h-4 w-4" />
                    {t("chat.loginBtn")}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
