"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adjustStock, setStock, type StockResult } from "@/app/admin/(panel)/estoque/actions";
import { StatusBadge } from "@/components/admin/status-badge";

type Props = {
  productId: string;
  storeId: string;
  name: string;
  note?: string;
  quantity: number;
  historyHref: string;
};

const FAILED = "Não foi possível salvar. Tente de novo.";

// Shows confirmed (database) quantity plus in-flight deltas; every response
// replaces the confirmed value with what the database returned.
export function StockRow({ productId, storeId, name, note, quantity, historyHref }: Props) {
  const [confirmed, setConfirmed] = useState(quantity);
  const [pendingDelta, setPendingDelta] = useState(0);
  const [busy, setBusy] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Adopt server refreshes (e.g. another person's change) when idle.
  useEffect(() => {
    if (busy === 0) setConfirmed(quantity);
  }, [quantity, busy]);

  const shown = confirmed + pendingDelta;

  async function run(task: () => Promise<StockResult>, delta = 0) {
    setError(null);
    setBusy((n) => n + 1);
    setPendingDelta((d) => d + delta);
    try {
      const result = await task();
      if (result.ok && result.quantity !== undefined) setConfirmed(result.quantity);
      else setError(result.message ?? FAILED);
    } catch {
      setError(FAILED);
    } finally {
      setPendingDelta((d) => d - delta);
      setBusy((n) => n - 1);
    }
  }

  function saveDraft() {
    if (!/^\d+$/.test(draft.trim())) {
      setError("Use um número inteiro, sem vírgula.");
      return;
    }
    const value = Number(draft);
    setEditing(false);
    void run(() => setStock(productId, storeId, value));
  }

  return (
    <li className={`space-y-3 rounded-2xl border bg-white p-3 ${shown === 0 ? "border-raspberry/30" : "border-cocoa/10"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{name}</p>
          {note && <p className="text-xs text-cocoa-soft">{note}</p>}
          <Link href={historyHref} className="text-xs text-olive underline">
            Histórico
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {shown === 0 && <StatusBadge tone="red">Esgotado</StatusBadge>}
          <span aria-live="polite" className={`min-w-10 text-right text-2xl tabular-nums ${busy ? "text-cocoa-soft" : ""}`}>
            {shown}
          </span>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            inputMode="numeric"
            aria-label={`Nova quantidade de ${name}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveDraft()}
            className="field-input w-24"
          />
          <button type="button" onClick={saveDraft} className="btn btn-primary">
            Salvar
          </button>
          <button type="button" onClick={() => setEditing(false)} className="btn btn-secondary">
            Cancelar
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            aria-label={`Tirar 1 de ${name}`}
            disabled={shown <= 0}
            onClick={() => run(() => adjustStock(productId, storeId, -1), -1)}
            className="btn btn-secondary px-0 text-lg"
          >
            −
          </button>
          <button
            type="button"
            aria-label={`Somar 1 em ${name}`}
            onClick={() => run(() => adjustStock(productId, storeId, 1), 1)}
            className="btn btn-secondary px-0 text-lg"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(String(shown));
              setEditing(true);
            }}
            className="btn btn-secondary px-0"
          >
            Definir
          </button>
          <button
            type="button"
            disabled={shown === 0}
            onClick={() => run(() => setStock(productId, storeId, 0))}
            className="btn btn-danger px-0"
          >
            Esgotar
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-raspberry">
          {error}
        </p>
      )}
    </li>
  );
}
