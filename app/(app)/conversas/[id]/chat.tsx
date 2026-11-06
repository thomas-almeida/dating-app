"use client";

import { Check, CheckCheck, LoaderCircle, Send } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { CHAT_POLL_MS, MAX_MESSAGE_LENGTH } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";
import { markChatRead, sendMessage } from "../actions";

// Fuso fixo: o servidor e o celular precisam escrever a mesma hora, senão a hidratação reclama.
const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function Bubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-3xl px-4 py-2 text-sm leading-relaxed ${
          mine ? "rounded-br-lg bg-coral text-ink" : "rounded-bl-lg bg-surface text-cream"
        }`}
      >
        <p className="break-words whitespace-pre-wrap">{message.body}</p>
        <p
          className={`mt-0.5 flex items-center justify-end gap-1 text-[0.7rem] ${
            mine ? "text-ink/70" : "text-muted"
          }`}
        >
          {timeFormat.format(new Date(message.created_at))}
          {mine &&
            (message.read_at ? (
              <CheckCheck className="size-3.5" role="img" aria-label="Visualizada" />
            ) : (
              <Check className="size-3.5" role="img" aria-label="Enviada" />
            ))}
        </p>
      </div>
    </li>
  );
}

export function Chat({
  personId,
  personName,
  initialMessages,
}: {
  personId: string;
  personName: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const end = useRef<HTMLLIElement>(null);

  const sync = useCallback(async () => {
    // Direto no Supabase: passar pelo servidor custaria uma função a cada consulta.
    const { data } = await createClient().rpc("chat_messages", { p_with: personId });
    if (!data) return;

    const next = [...(data as ChatMessage[])].reverse();
    setMessages(next);

    // Só conta como visto com a conversa na tela.
    const unread = next.some((message) => message.sender_id === personId && !message.read_at);
    if (unread && document.visibilityState === "visible") await markChatRead(personId);
  }, [personId]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void sync();
    };

    const first = setTimeout(tick);
    const timer = setInterval(tick, CHAT_POLL_MS);
    document.addEventListener("visibilitychange", tick);

    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [sync]);

  useLayoutEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setFailed(false);
    const result = await sendMessage(personId, body).catch(() => ({ ok: false }));
    setSending(false);

    if (!result.ok) {
      setFailed(true);
      return;
    }

    setDraft("");
    void sync();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  // No computador, Enter envia. No celular, o teclado usa o botão.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        {messages.length === 0 ? (
          <p className="mx-auto mt-10 max-w-xs text-center text-sm leading-relaxed text-muted">
            Vocês deram match. Diga oi para {personName}!
          </p>
        ) : (
          <ul aria-label="Mensagens" className="space-y-2">
            {messages.map((message) => (
              <Bubble key={message.id} message={message} mine={message.sender_id !== personId} />
            ))}
            <li ref={end} aria-hidden />
          </ul>
        )}
      </div>

      {failed && (
        <p role="alert" className="px-4 pb-1 text-center text-xs text-coral">
          Não deu para enviar. Tente de novo.
        </p>
      )}

      <form onSubmit={handleSubmit} className="pb-safe shrink-0 px-3 pt-1">
        <div className="mb-3 flex items-end gap-2">
          <textarea
            aria-label="Mensagem"
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Escreva uma mensagem"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            className="max-h-32 min-h-12 w-full resize-none rounded-3xl border border-line bg-surface px-4 py-3 text-cream placeholder:text-muted/70 transition focus:border-coral focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Enviar"
            disabled={sending || !draft.trim()}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-coral text-ink transition active:scale-95 disabled:opacity-50"
          >
            {sending ? (
              <LoaderCircle className="size-5 animate-spin" aria-hidden />
            ) : (
              <Send className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </form>
    </>
  );
}
