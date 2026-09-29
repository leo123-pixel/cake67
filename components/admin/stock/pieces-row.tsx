"use client";

import Link from "next/link";
import { useState } from "react";
import {
  addPiece,
  correctPieceWeight,
  discardPiece,
  sellPiece,
  type PieceResult,
} from "@/app/admin/(panel)/estoque/actions";
import { ActionsMenu, type MenuAction } from "@/components/admin/actions-menu";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatBRL } from "@/lib/money";
import type { GridPiece } from "@/lib/stock-grid";
import { daysOnShowcase, formatKg, gramsToInput, parseKgToGrams, piecePriceCents } from "@/lib/weight";

type Props = {
  productId: string;
  storeId: string;
  name: string;
  note?: string;
  priceCents: number;
  pieces: GridPiece[];
  historyHref: string;
  productActions?: MenuAction[];
};

const FAILED = "Não foi possível salvar. Tente de novo.";
const BAD_WEIGHT = "Digite o peso da balança em kg, ex. 1,340 (entre 0,300 e 10,000).";

// Whole cakes sold by weight: one line per cake in the showcase. The list
// refreshes from the server after each change (revalidatePath).
export function PiecesRow({ productId, storeId, name, note, priceCents, pieces, historyHref, productActions = [] }: Props) {
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = pieces.filter((piece) => piece.status === "disponivel").length;

  async function run(task: () => Promise<PieceResult>): Promise<boolean> {
    setError(null);
    setBusy(true);
    try {
      const result = await task();
      if (!result.ok) setError(result.message ?? FAILED);
      return result.ok;
    } catch {
      setError(FAILED);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const grams = parseKgToGrams(weight);
    if (grams === null) {
      setError(BAD_WEIGHT);
      return;
    }
    if (await run(() => addPiece(productId, storeId, grams))) setWeight("");
  }

  return (
    <li className={`space-y-3 rounded-2xl border bg-white p-3 ${available === 0 ? "border-raspberry/30" : "border-cocoa/10"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{name}</p>
          <p className="text-xs text-cocoa-soft">
            {note ?? `Bolo inteiro por peso · ${formatBRL(priceCents)} o kg`}
          </p>
          <Link href={historyHref} className="-my-3.5 inline-block py-3.5 text-xs text-olive underline">
            Histórico
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {available === 0 ? (
            <StatusBadge tone="red">Esgotado</StatusBadge>
          ) : (
            <span aria-live="polite" className="text-lg tabular-nums">
              {available} {available === 1 ? "bolo" : "bolos"}
            </span>
          )}
          {productActions.length > 0 && <ActionsMenu label={name} actions={productActions} />}
        </div>
      </div>

      {pieces.length > 0 && (
        <ul className="divide-y divide-cocoa/10 rounded-xl border border-cocoa/10">
          {pieces.map((piece) => (
            <PieceLine key={piece.id} piece={piece} name={name} priceCents={priceCents} busy={busy} run={run} />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          inputMode="decimal"
          aria-label={`Peso do novo ${name} em kg`}
          placeholder="Peso, ex. 1,340"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          className="field-input w-36"
        />
        <button type="button" disabled={busy} onClick={() => void add()} className="btn btn-primary">
          Adicionar bolo
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-raspberry">
          {error}
        </p>
      )}
    </li>
  );
}

type LineProps = {
  piece: GridPiece;
  name: string;
  priceCents: number;
  busy: boolean;
  run: (task: () => Promise<PieceResult>) => Promise<boolean>;
};

function PieceLine({ piece, name, priceCents, busy, run }: LineProps) {
  const [mode, setMode] = useState<"idle" | "menu" | "weight" | "discard">("idle");
  const [draft, setDraft] = useState("");
  const label = `${formatKg(piece.weightG)} · ${formatBRL(piecePriceCents(priceCents, piece.weightG))}`;
  const since = daysOnShowcase(piece.createdAt);

  async function saveWeight() {
    const grams = parseKgToGrams(draft);
    if (grams === null) {
      await run(async () => ({ ok: false, message: BAD_WEIGHT }));
      return;
    }
    if (await run(() => correctPieceWeight(piece.id, grams))) setMode("idle");
  }

  if (piece.status === "reservado") {
    return (
      <li className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-sm">
        <span className="tabular-nums">{label}</span>
        <StatusBadge tone="amber">Reservado · {piece.orderCode ?? "pedido"}</StatusBadge>
      </li>
    );
  }

  return (
    <li className="space-y-2 p-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="tabular-nums">
          {label} <span className="text-cocoa-soft">· {since === "hoje" ? "desde hoje" : `há ${since}`}</span>
        </span>
        <button
          type="button"
          aria-expanded={mode !== "idle"}
          aria-label={`Ações do ${name} de ${formatKg(piece.weightG)}`}
          onClick={() => setMode(mode === "idle" ? "menu" : "idle")}
          className="btn btn-secondary min-h-11 px-3"
        >
          {mode === "idle" ? "Ações" : "Fechar"}
        </button>
      </div>

      {mode === "menu" && (
        <div className="grid grid-cols-3 gap-2">
          <button type="button" disabled={busy} onClick={() => void run(() => sellPiece(piece.id))} className="btn btn-primary px-0">
            Vendida no balcão
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDraft(gramsToInput(piece.weightG));
              setMode("weight");
            }}
            className="btn btn-secondary px-0"
          >
            Corrigir peso
          </button>
          <button type="button" disabled={busy} onClick={() => setMode("discard")} className="btn btn-danger px-0">
            Descartar
          </button>
        </div>
      )}

      {mode === "weight" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            inputMode="decimal"
            aria-label={`Peso correto do ${name} em kg`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void saveWeight()}
            className="field-input w-28"
          />
          <button type="button" disabled={busy} onClick={() => void saveWeight()} className="btn btn-primary">
            Salvar
          </button>
          <button type="button" onClick={() => setMode("menu")} className="btn btn-secondary">
            Voltar
          </button>
        </div>
      )}

      {mode === "discard" && (
        <div className="flex flex-wrap items-center gap-2">
          <span>Descartar o bolo de {formatKg(piece.weightG)}? Ele sai da vitrine.</span>
          <button type="button" disabled={busy} onClick={() => void run(() => discardPiece(piece.id))} className="btn btn-danger">
            Confirmar descarte
          </button>
          <button type="button" onClick={() => setMode("menu")} className="btn btn-secondary">
            Voltar
          </button>
        </div>
      )}
    </li>
  );
}
