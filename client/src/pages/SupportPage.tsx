import { AppShell, PageHeading } from "@/components/ChromaShell";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/_core/hooks/useAuth";
import { MessageCircle, Radio, Send, Ticket, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const categories = [
  ["subscription", "Проблема с подпиской"],
  ["bug", "Баг сайта"],
  ["account", "Проблема с аккаунтом"],
  ["loader", "Проблема с Loader"],
  ["other", "Другой вопрос"],
] as const;

type TicketThreadProps = { ticketId: number; staff?: boolean };

function playMessageTone() {
  if (typeof window === "undefined") return;
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;
  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(740, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + 0.12);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.24);
  window.setTimeout(() => void context.close(), 350);
}

function TicketThread({ ticketId, staff = false }: TicketThreadProps) {
  const { supabaseUser } = useAuth();
  const { data, refetch, isFetching } = trpc.support.get.useQuery({ ticketId }, { refetchInterval: 5000, refetchIntervalInBackground: true });
  const [body, setBody] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "reconnecting">("connecting");
  const knownMessageIds = useRef<Set<number>>(new Set());
  const hydrated = useRef(false);
  const messageList = useRef<HTMLDivElement>(null);
  const refetchTimer = useRef<number | null>(null);
  const reply = trpc.support.reply.useMutation({ onSuccess: () => { setBody(""); void refetch(); } });
  const botSuggestion = trpc.support.autoReplySuggestion.useQuery({ ticketId }, { enabled: staff, refetchInterval: staff ? 3500 : false, refetchIntervalInBackground: true });

  useEffect(() => {
    setSoundEnabled(localStorage.getItem("chroma-chat-sound") !== "off");
  }, []);

  useEffect(() => {
    if (!data) return;
    const incoming = data.messages.filter(row => !knownMessageIds.current.has(row.message.id));
    const hasIncoming = incoming.some(row => row.message.authorOpenId !== supabaseUser?.id);
    knownMessageIds.current = new Set(data.messages.map(row => row.message.id));
    if (hydrated.current && hasIncoming && soundEnabled) playMessageTone();
    hydrated.current = true;
    window.requestAnimationFrame(() => { if (messageList.current) messageList.current.scrollTop = messageList.current.scrollHeight; });
  }, [data, soundEnabled, supabaseUser?.id]);

  useEffect(() => {
    const scheduleRefresh = () => { if (refetchTimer.current !== null) return; refetchTimer.current = window.setTimeout(() => { refetchTimer.current = null; void refetch(); }, 120); };
    const channel = supabase.channel(`support-ticket-${ticketId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticketId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${ticketId}` }, scheduleRefresh)
      .subscribe(status => setConnectionState(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "reconnecting" : "connecting"));
    return () => { if (refetchTimer.current !== null) window.clearTimeout(refetchTimer.current); void supabase.removeChannel(channel); };
  }, [ticketId, refetch]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("chroma-chat-sound", next ? "on" : "off");
    if (next) playMessageTone();
  };

  if (!data) return <div className="surface p-6 text-sm text-muted-foreground">Загрузка тикета…</div>;
  return <div className="chat-panel flex min-h-[560px] flex-col overflow-hidden rounded-2xl">
    <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-white/[.025] p-5">
      <div><div className="eyebrow">#{data.ticket.id} · {data.ticket.category}</div><h2 className="mt-2 text-lg font-semibold">{data.ticket.subject}</h2><div className="mt-2 flex items-center gap-2 text-[11px] text-primary"><span className="live-dot" />{connectionState === "live" && !isFetching ? "Синхронизация в реальном времени" : connectionState === "reconnecting" ? "Переподключение…" : "Синхронизация…"}</div></div>
      <div className="flex items-center gap-2"><button onClick={toggleSound} title={soundEnabled ? "Выключить звук" : "Включить звук"} className="rounded-lg border border-white/10 p-2 text-muted-foreground hover:border-primary/40 hover:text-primary">{soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button><span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.15em] text-primary">{data.ticket.status}</span></div>
    </div>
    <div ref={messageList} className="grid flex-1 content-start gap-3 overflow-auto scroll-smooth bg-[radial-gradient(circle_at_top_right,rgba(190,255,92,.07),transparent_30%)] p-5">
      {data.messages.map(row => { const fromUser = row.message.authorOpenId === data.ticket.userOpenId; return <div key={row.message.id} className={`chat-bubble max-w-[86%] rounded-2xl border p-3 text-sm ${fromUser ? "border-white/10 bg-white/[.035]" : "ml-auto border-primary/20 bg-primary/[.08]"}`}><div className="mb-1 flex items-center justify-between gap-4 text-[10px] text-muted-foreground"><span>{row.author.name || row.author.username || row.author.email || (fromUser ? "Пользователь" : "Support")}</span><span>{new Date(row.message.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span></div><div className="whitespace-pre-wrap leading-6">{row.message.body}</div></div>; })}
    </div>
    <div className="border-t border-white/10 bg-black/10 p-4">{staff && botSuggestion.data?.body && <div className="mb-3 rounded-xl border border-primary/20 bg-primary/[.06] p-3"><div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[.12em] text-primary"><span>Автоответ бот · подсказка</span><button onClick={() => setBody(botSuggestion.data?.body ?? "")} className="rounded-lg border border-primary/20 px-2 py-1 normal-case tracking-normal text-primary hover:bg-primary/10">Вставить</button></div><p className="text-xs leading-5 text-muted-foreground">{botSuggestion.data.body}</p><Button disabled={reply.isPending} onClick={() => reply.mutate({ ticketId, body: botSuggestion.data?.body ?? "" })} variant="outline" className="mt-2 h-8 rounded-lg border-primary/25 bg-transparent px-3 text-xs text-primary">Отправить ответ бота</Button></div>}<div className="flex gap-2"><textarea value={body} onChange={event => setBody(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (body.trim()) reply.mutate({ ticketId, body }); } }} placeholder={staff ? "Ответить пользователю… (Enter — отправить)" : "Ваш ответ… (Enter — отправить)"} className="min-h-12 flex-1 resize-none rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-sm outline-none transition focus:border-primary/60" /><Button disabled={!body.trim() || reply.isPending} onClick={() => reply.mutate({ ticketId, body })} className="self-end rounded-xl bg-primary text-[#10150c]"><Send className="mr-2 h-4 w-4" />Отправить</Button></div><div className="mt-2 text-[10px] text-muted-foreground">Сообщения доставляются без перезагрузки страницы. Shift + Enter — новая строка.</div></div>
  </div>;
}

export function SupportPage() {
  const tickets = trpc.support.list.useQuery(undefined, { refetchInterval: 7000, refetchIntervalInBackground: true });
  const [selected, setSelected] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<typeof categories[number][0]>("subscription");
  const create = trpc.support.create.useMutation({ onSuccess: result => { setSubject(""); setBody(""); setSelected(result.id); void tickets.refetch(); } });
  useEffect(() => { const channel = supabase.channel("support-ticket-list").on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => void tickets.refetch()).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [tickets.refetch]);
  return <AppShell><div className="container max-w-[1220px] py-8 sm:py-10"><div className="flex flex-wrap items-end justify-between gap-4"><PageHeading eyebrow="Support / Live inbox" title="Поддержка" description="Создайте тикет и продолжайте диалог с командой CHROMA в реальном времени." /><div className="rounded-xl border border-primary/20 bg-primary/[.06] px-3 py-2 text-xs text-primary"><Radio className="mr-2 inline h-3.5 w-3.5" />Live-синхронизация включена</div></div><div className="mt-8 grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
    <section className="surface p-5"><div className="flex items-center gap-2"><Ticket className="h-4 w-4 text-primary" /><h2 className="font-semibold">Мои обращения</h2><span className="ml-auto text-xs text-muted-foreground">{tickets.data?.length ?? 0}</span></div><div className="mt-4 grid gap-2">{tickets.data?.map(ticket => <button key={ticket.id} onClick={() => setSelected(ticket.id)} className={`rounded-xl border p-4 text-left transition ${selected === ticket.id ? "border-primary/45 bg-primary/[.06] shadow-[0_0_24px_rgba(190,255,92,.08)]" : "border-white/10 bg-white/[.025] hover:border-primary/25"}`}><div className="flex justify-between gap-3 text-sm font-semibold"><span className="truncate">#{ticket.id} · {ticket.subject}</span><span className="text-[10px] uppercase text-primary">{ticket.status}</span></div><div className="mt-2 text-xs text-muted-foreground">{ticket.category} · обновлено {new Date(ticket.updatedAt).toLocaleString("ru-RU")}</div></button>)}{!tickets.data?.length && <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">Обращений пока нет.</div>}</div></section>
    {selected ? <TicketThread ticketId={selected} /> : <section className="glass rounded-2xl p-5"><div className="eyebrow">New ticket</div><h2 className="mt-2 text-xl font-semibold">Опишите проблему</h2><div className="mt-5 grid gap-3"><select value={category} onChange={event => setCategory(event.target.value as typeof category)} className="h-11 rounded-xl border border-white/10 bg-white/[.04] px-3 text-sm"><option value="subscription">Проблема с подпиской</option><option value="bug">Баг сайта</option><option value="account">Проблема с аккаунтом</option><option value="loader">Проблема с Loader</option><option value="other">Другой вопрос</option></select><input value={subject} onChange={event => setSubject(event.target.value)} placeholder="Короткая тема" className="h-11 rounded-xl border border-white/10 bg-white/[.04] px-3 text-sm outline-none focus:border-primary/60" /><textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Что произошло? Добавьте текст ошибки, если он есть." className="min-h-40 rounded-xl border border-white/10 bg-white/[.04] px-3 py-3 text-sm outline-none focus:border-primary/60" /><Button disabled={create.isPending || !subject.trim() || !body.trim()} onClick={() => create.mutate({ subject, body, category })} className="h-11 rounded-xl bg-primary font-bold text-[#10150c]"><MessageCircle className="mr-2 h-4 w-4" />Создать обращение</Button></div></section>}
  </div></div></AppShell>;
}

export function SupportPanelPage() {
  const queue = trpc.support.queue.useQuery(undefined, { refetchInterval: 7000, refetchIntervalInBackground: true });
  const [selected, setSelected] = useState<number | null>(null);
  const update = trpc.support.update.useMutation({ onSuccess: () => void queue.refetch() });
  useEffect(() => { const channel = supabase.channel("support-queue").on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => void queue.refetch()).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [queue.refetch]);
  return <AppShell><div className="container max-w-[1280px] py-8 sm:py-10"><div className="flex items-start justify-between gap-4"><PageHeading eyebrow="Supp-panel / Live staff inbox" title="Активные обращения" description="Очередь тикетов, история переписки и быстрые статусы для команды." /><div className="flex items-center gap-2"><span className="hidden text-xs text-primary sm:inline"><span className="live-dot mr-2 inline-block" />Онлайн</span><Button onClick={() => queue.refetch()} variant="outline" className="rounded-xl border-white/10 bg-transparent">Обновить</Button></div></div><div className="mt-8 grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><section className="grid content-start gap-2">{queue.data?.map(row => <button key={row.ticket.id} onClick={() => setSelected(row.ticket.id)} className={`surface p-4 text-left transition ${selected === row.ticket.id ? "border-primary/50" : "hover:border-primary/25"}`}><div className="flex justify-between gap-3"><span className="truncate font-semibold">#{row.ticket.id} · {row.ticket.subject}</span><span className="text-[10px] uppercase text-primary">{row.ticket.status}</span></div><div className="mt-2 text-xs text-muted-foreground">{row.user.email || row.user.name || `User #${row.user.id}`} · {row.ticket.category}</div><div className="mt-3 flex gap-2"><span className="rounded-lg border border-white/10 px-2 py-1 text-[10px]">{row.ticket.priority}</span><span className="rounded-lg border border-white/10 px-2 py-1 text-[10px]">обновляется live</span><button onClick={event => { event.stopPropagation(); update.mutate({ ticketId: row.ticket.id, status: "closed" }); }} className="ml-auto rounded-lg border border-white/10 px-2 py-1 text-[10px] hover:border-primary/40">Закрыть</button></div></button>)}{!queue.data?.length && <div className="surface p-10 text-center text-sm text-muted-foreground">Активных обращений нет.</div>}</section>{selected ? <TicketThread ticketId={selected} staff /> : <div className="surface grid min-h-[420px] place-items-center rounded-2xl p-8 text-center text-sm text-muted-foreground"><div><MessageCircle className="mx-auto h-8 w-8 text-primary/60" /><p className="mt-3">Выберите тикет слева, чтобы открыть переписку.</p></div></div>}</div></div></AppShell>;
}
