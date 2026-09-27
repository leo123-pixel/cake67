"use client";

import { useEffect, useRef, useState } from "react";
import {
  answerQuestion,
  ASSISTANT_GREETING,
  ASSISTANT_SUGGESTIONS,
  type AssistantAction,
  type AssistantAnswer,
  type AssistantData,
} from "@/lib/assistant";
import { scrollToId } from "@/lib/site-events";
import { whatsappLink } from "@/lib/whatsapp";

type Message = AssistantAnswer & { id: number; from: "bot" | "me" };

const TARGETS: Record<AssistantAction, { id: string; block: ScrollLogicalPosition }> = {
  vitrine: { id: "vitrine", block: "start" },
  calc: { id: "ck-calc", block: "center" },
  cfg: { id: "ck-cfg", block: "center" },
  lojas: { id: "lojas", block: "start" },
};

// "Dúvidas? Fale com a Cake": answers come from lib/assistant rules (AD-012).
export function Assistant({ data, whatsapp }: { data: AssistantData; whatsapp: string | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: "bot", text: ASSISTANT_GREETING }]);
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function ask(question: string) {
    const text = question.trim();
    if (!text) return;
    setMessages((current) => [...current, { id: nextId.current++, from: "me", text }]);
    window.setTimeout(() => {
      setMessages((current) => [...current, { id: nextId.current++, from: "bot", ...answerQuestion(text, data) }]);
    }, 400);
  }

  function go(action: AssistantAction) {
    setOpen(false);
    scrollToId(TARGETS[action].id, TARGETS[action].block);
  }

  return (
    <>
      <button type="button" className="ck-fab" aria-expanded={open} aria-controls="ck-chat" onClick={() => setOpen(!open)}>
        <span className="ck-dot">
          <span className="ck-mark" />
        </span>
        <span className="ck-t">Dúvidas? Fale com a Cake</span>
        <span className="sr-only">Abrir assistente</span>
      </button>
      {open && (
        <section className="ck-chat" id="ck-chat" aria-label="Assistente Cake 67">
          <header>
            <div>
              <b>Assistente Cake 67</b>
              <small>Cardápio, preços, prazos e lojas</small>
            </div>
            <button type="button" className="ck-x" aria-label="Fechar" onClick={() => setOpen(false)}>
              ✕
            </button>
          </header>
          <div className="ck-msgs" ref={list} aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`ck-m ${message.from === "bot" ? "ck-bot" : "ck-me"}`}>
                {message.text}
                {message.action && (
                  <>
                    {" "}
                    <button type="button" className="ck-link" onClick={() => go(message.action!.target)}>
                      {message.action.label}
                    </button>
                  </>
                )}
                {message.whatsappText && whatsapp && (
                  <>
                    {" "}
                    <a className="ck-link" href={whatsappLink(whatsapp, message.whatsappText)} target="_blank" rel="noopener noreferrer">
                      Falar no WhatsApp
                    </a>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="ck-sugs">
            {ASSISTANT_SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => ask(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask(draft);
              setDraft("");
            }}
          >
            <label htmlFor="ck-chat-in" className="sr-only">
              Sua pergunta
            </label>
            <input
              id="ck-chat-in"
              ref={input}
              className="ck-field"
              placeholder="Pergunte algo…"
              autoComplete="off"
              maxLength={200}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit">Enviar</button>
          </form>
        </section>
      )}
    </>
  );
}
