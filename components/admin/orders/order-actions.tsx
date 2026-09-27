"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  advanceOrder,
  cancelOrder,
  reactivateOrder,
  type OrderActionResult,
} from "@/app/admin/(panel)/pedidos/actions";
import {
  ACTION_LABELS,
  CANCEL_REASONS,
  canCancel,
  nextStatuses,
  OTHER_REASON,
  type OrderStatus,
} from "@/lib/order-status";

type Props = { orderId: string; status: OrderStatus; hasMadeToOrder: boolean };

export function OrderActions({ orderId, status, hasMadeToOrder }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  const [note, setNote] = useState("");

  function run(task: () => Promise<OrderActionResult>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await task();
        if (!result.ok) {
          setError(result.message ?? "Não foi possível concluir.");
          router.refresh();
          return;
        }
        setCancelling(false);
      } catch {
        setError("Sem conexão. Tente de novo.");
      }
    });
  }

  const next = nextStatuses(status, hasMadeToOrder);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {next.map((to, index) => (
          <button
            key={to}
            type="button"
            disabled={pending}
            onClick={() => run(() => advanceOrder(orderId, status, to))}
            className={index === 0 ? "btn btn-primary" : "btn btn-secondary"}
          >
            {ACTION_LABELS[to]}
          </button>
        ))}
        {status === "expirado" && (
          <button type="button" disabled={pending} onClick={() => run(() => reactivateOrder(orderId))} className="btn btn-primary">
            Reativar e confirmar
          </button>
        )}
        {canCancel(status) && !cancelling && (
          <button type="button" disabled={pending} onClick={() => setCancelling(true)} className="btn btn-danger">
            Cancelar pedido
          </button>
        )}
      </div>

      {status === "expirado" && (
        <p className="text-sm text-cocoa-soft">Reativar separa os itens da vitrine de novo, se ainda houver.</p>
      )}

      {cancelling && (
        <fieldset className="space-y-3 rounded-2xl border border-raspberry/30 bg-white p-4">
          <legend className="px-1 font-medium text-raspberry">Motivo do cancelamento</legend>
          {CANCEL_REASONS.map((option) => (
            <label key={option} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="radio"
                name="reason"
                value={option}
                checked={reason === option}
                onChange={() => setReason(option)}
                className="accent-raspberry"
              />
              {option}
            </label>
          ))}
          {reason === OTHER_REASON && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={180}
              placeholder="Descreva o motivo"
              aria-label="Descreva o motivo"
              className="field-input"
            />
          )}
          <p className="text-sm text-cocoa-soft">Os itens da vitrine voltam para o estoque.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => cancelOrder(orderId, status, reason, note))}
              className="btn bg-raspberry text-linen"
            >
              Confirmar cancelamento
            </button>
            <button type="button" onClick={() => setCancelling(false)} className="btn btn-secondary">
              Voltar
            </button>
          </div>
        </fieldset>
      )}

      {error && (
        <p role="alert" className="text-sm text-raspberry">
          {error}
        </p>
      )}
    </div>
  );
}
