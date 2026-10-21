"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  advanceOrder,
  cancelOrder,
  reactivateOrder,
  retryRefund,
  type OrderActionResult,
} from "@/app/admin/(panel)/pedidos/actions";
import {
  ACTION_LABELS,
  CANCEL_REASONS,
  canCancel,
  nextStatuses,
  NOTIFY_STATUSES,
  OTHER_REASON,
  type OrderStatus,
} from "@/lib/order-status";
import { formatBRL } from "@/lib/money";

// notifyHref: wa.me link to the customer with the confirmation message (spec 08).
// paidCents: paid through the site, refunded on cancel; refundPending: the
// last refund failed (spec 11, D11).
type Props = {
  orderId: string;
  status: OrderStatus;
  hasMadeToOrder: boolean;
  notifyHref: string | null;
  paidCents: number | null;
  refundPending: boolean;
};

export function OrderActions({ orderId, status, hasMadeToOrder, notifyHref, paidCents, refundPending }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<OrderActionResult["notice"]>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  const [note, setNote] = useState("");

  // notify: after a confirmation, send the customer to WhatsApp. The tab is
  // opened within the click, since window.open after an await is blocked as
  // a pop-up; it only goes to WhatsApp if the action succeeded.
  function run(task: () => Promise<OrderActionResult>, notify = false) {
    setError(null);
    setNotice(null);
    const tab = notify && notifyHref ? window.open("", "_blank") : null;
    startTransition(async () => {
      try {
        const result = await task();
        if (!result.ok) {
          tab?.close();
          setError(result.message ?? "Não foi possível concluir.");
          router.refresh();
          return;
        }
        if (tab && notifyHref) {
          tab.opener = null;
          tab.location.href = notifyHref;
        }
        setNotice(result.notice ?? null);
        setCancelling(false);
      } catch {
        tab?.close();
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
            onClick={() => run(() => advanceOrder(orderId, status, to), to === "confirmado")}
            className={index === 0 ? "btn btn-primary" : "btn btn-secondary"}
          >
            {ACTION_LABELS[to]}
          </button>
        ))}
        {status === "expirado" && (
          <button type="button" disabled={pending} onClick={() => run(() => reactivateOrder(orderId), true)} className="btn btn-primary">
            Reativar e confirmar
          </button>
        )}
        {notifyHref && NOTIFY_STATUSES.includes(status) && (
          <a href={notifyHref} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            Avisar cliente no WhatsApp
          </a>
        )}
        {refundPending && (
          <button type="button" disabled={pending} onClick={() => run(() => retryRefund(orderId))} className="btn btn-danger">
            Tentar devolver de novo
          </button>
        )}
        {canCancel(status) && !cancelling && (
          <button type="button" disabled={pending} onClick={() => setCancelling(true)} className="btn btn-danger">
            Cancelar pedido
          </button>
        )}
      </div>

      {status === "novo" && notifyHref && (
        <p className="text-sm text-cocoa-soft">Ao confirmar, o WhatsApp do cliente abre com o aviso pronto. É só enviar.</p>
      )}

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
          {paidCents !== null && (
            <p className="rounded-xl bg-raspberry/10 p-3 text-sm font-medium text-raspberry">
              O pagamento de {formatBRL(paidCents)} feito pelo site será devolvido ao cliente. A tarifa da Stripe não volta.
            </p>
          )}
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

      {refundPending && !notice && (
        <p className="text-sm text-raspberry">A devolução do pagamento falhou. Tente de novo; se continuar, devolva pelo painel da Stripe.</p>
      )}

      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"} className={`text-sm ${notice.tone === "error" ? "text-raspberry" : "text-olive"}`}>
          {notice.text}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-raspberry">
          {error}
        </p>
      )}
    </div>
  );
}
