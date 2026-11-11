"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { placeOrder } from "@/app/(site)/actions";
import { toOrderItems } from "@/lib/cart/cart";
import { formatWeekdayDate } from "@/lib/datetime";
import { formatBRL } from "@/lib/money";
import { buildSlots } from "@/lib/schedule";
import type { CheckoutStore } from "@/lib/storefront";
import type { FieldErrors } from "@/lib/validators/common";
import { resolveStore } from "./cart-view";
import { useCart } from "./use-cart";
import { useDeliveryFee, type DeliveryAddressFields } from "./use-delivery-fee";
import { useQuote } from "./use-quote";

const EMPTY_ADDRESS: DeliveryAddressFields = {
  delivery_street: "",
  delivery_number: "",
  delivery_complement: "",
  delivery_district: "",
  delivery_reference: "",
};

// Stage 11: address in fields; city is always Campo Grande - MS.
const ADDRESS_FIELDS = [
  { name: "delivery_street", label: "Rua", autoComplete: "address-line1", maxLength: 120, required: true, wide: true },
  { name: "delivery_number", label: "Número", autoComplete: "off", maxLength: 20, required: true },
  { name: "delivery_complement", label: "Complemento", autoComplete: "address-line2", maxLength: 60, required: false },
  { name: "delivery_district", label: "Bairro", autoComplete: "address-level3", maxLength: 80, required: true, wide: true },
  { name: "delivery_reference", label: "Ponto de referência", autoComplete: "off", maxLength: 120, required: false, wide: true },
] as const;

function FieldError({ errors, name }: { errors: FieldErrors; name: string }) {
  const message = errors[name]?.[0];
  return message ? (
    <p id={`${name}-error`} className="text-sm text-raspberry">
      {message}
    </p>
  ) : null;
}

// Not a <form action>: a failed submit must keep everything the customer typed.
export function CheckoutForm({ stores }: { stores: CheckoutStore[] }) {
  const router = useRouter();
  const { cart, clear } = useCart();
  const store = resolveStore(stores, cart.storeSlug);
  const { quote, loading } = useQuote(store?.id ?? null, cart);
  // Until the customer changes them, start from what the home cake builder picked.
  const [chosenFulfillment, setFulfillment] = useState<"retirada" | "entrega" | null>(null);
  const [chosenDay, setDay] = useState("");
  const fulfillment = chosenFulfillment ?? cart.preferred?.fulfillment ?? "retirada";
  const day = chosenDay || cart.preferred?.day || "";
  const [slot, setSlot] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [needsCart, setNeedsCart] = useState(false);
  const [pending, startTransition] = useTransition();
  const [address, setAddress] = useState<DeliveryAddressFields>(EMPTY_ADDRESS);
  const [deliveryFee, overrideFee] = useDeliveryFee(store?.id ?? null, fulfillment === "entrega", address);

  if (cart.lines.length === 0) {
    return (
      <div className="space-y-4 rounded-3xl border border-cocoa/10 bg-white p-8">
        <p className="text-lg">Seu pedido está vazio.</p>
        <Link href="/cardapio" className="btn btn-primary">
          Ver a vitrine
        </Link>
      </div>
    );
  }
  if (!store) return <p>Nenhuma loja disponível no momento.</p>;

  const problems = quote?.lines.some((l) => l.problem) ?? false;
  const days = quote?.has_made_to_order && quote.earliest_schedule ? buildSlots(store.hours, quote.earliest_schedule) : [];
  const selectedDay = days.find((d) => d.date === day) ?? days[0];
  const hours = quote ? quote.reservation_minutes / 60 : 2;
  const reservation = Number.isInteger(hours) ? `${hours} h` : `${quote?.reservation_minutes} min`;
  const isDelivery = fulfillment === "entrega";
  const feeCents = isDelivery && deliveryFee.status === "ok" ? deliveryFee.feeCents : 0;
  const feeLoading = isDelivery && deliveryFee.status === "loading";
  // What the customer saw; the server only compares it with its own quote.
  const feeSeen = deliveryFee.status === "ok" ? String(deliveryFee.feeCents) : "a_combinar";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    setMessage(null);
    setErrors({});
    startTransition(async () => {
      try {
        const result = await placeOrder(store!.id, toOrderItems(cart), form);
        if (result.ok) {
          clear();
          router.push(`/pedido/${result.code}?t=${result.token}`);
          return;
        }
        setMessage(result.message);
        setErrors(result.fieldErrors ?? {});
        if (result.deliveryFee) overrideFee(result.deliveryFee);
        setNeedsCart(Boolean(result.soldOut?.length || result.unavailable?.length));
      } catch {
        setMessage("Não foi possível enviar agora. Seu carrinho continua salvo.");
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <section className="space-y-3 rounded-3xl border border-cocoa/10 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl text-olive">Resumo</h2>
          <Link href="/carrinho" className="text-sm text-olive underline">
            Editar
          </Link>
        </div>
        <ul className="space-y-1 text-sm">
          {cart.lines.map((line, index) => (
            <li key={line.key} className="flex justify-between gap-3">
              <span>
                {line.type === "cento" ? `${line.qty} un.` : `${line.qty}x`} {line.name}
                {line.label && <span className="text-cocoa-soft"> · {line.label}</span>}
              </span>
              <span className="shrink-0 tabular-nums">
                {quote?.lines[index] && !quote.lines[index].problem ? formatBRL(quote.lines[index].total_cents) : "—"}
              </span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-cocoa/10 pt-2 font-medium">
          <span>Subtotal</span>
          <span className="tabular-nums">{quote ? formatBRL(quote.subtotal_cents) : "…"}</span>
        </p>
        {isDelivery && (
          <>
            <p className="flex justify-between text-sm">
              <span>Entrega</span>
              <span className="tabular-nums" aria-live="polite">
                {deliveryFee.status === "ok"
                  ? formatBRL(deliveryFee.feeCents)
                  : deliveryFee.status === "loading"
                    ? "calculando…"
                    : deliveryFee.status === "idle"
                      ? "informe o endereço"
                      : "a combinar no WhatsApp"}
              </span>
            </p>
            <p className="flex justify-between border-t border-cocoa/10 pt-2 text-lg font-medium">
              <span>Total</span>
              <span className="tabular-nums">
                {quote ? formatBRL(quote.subtotal_cents + feeCents) : "…"}
                {deliveryFee.status === "a_combinar" && <span className="text-sm font-normal"> + entrega</span>}
              </span>
            </p>
          </>
        )}
        <p className="text-sm text-cocoa-soft">
          Loja: {store.name} · {store.address}. Pagamento combinado no WhatsApp.
        </p>
        {problems && (
          <p role="alert" className="text-sm text-raspberry">
            Há itens com problema. <Link href="/carrinho" className="underline">Revise o carrinho</Link>.
          </p>
        )}
      </section>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-xl text-olive">Seus dados</legend>
        <label className="block space-y-1.5 text-sm font-medium">
          Nome
          <input name="name" autoComplete="name" required maxLength={80} aria-invalid={Boolean(errors.name)} className="field-input" />
          <FieldError errors={errors} name="name" />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          WhatsApp
          <input
            name="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(67) 99999-9999"
            required
            aria-invalid={Boolean(errors.whatsapp)}
            className="field-input"
          />
          <FieldError errors={errors} name="whatsapp" />
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          CPF ou CNPJ na nota <span className="font-normal text-cocoa-soft">(opcional)</span>
          <input name="tax_id" inputMode="numeric" autoComplete="off" aria-invalid={Boolean(errors.tax_id)} className="field-input" />
          <FieldError errors={errors} name="tax_id" />
        </label>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-xl text-olive">Retirada ou entrega</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["retirada", "entrega"] as const).map((value) => (
            <label
              key={value}
              className="flex min-h-11 items-center gap-3 rounded-2xl border border-cocoa/15 bg-white px-4 has-checked:border-olive has-checked:bg-olive/5"
            >
              <input
                type="radio"
                name="fulfillment"
                value={value}
                checked={fulfillment === value}
                onChange={() => setFulfillment(value)}
                className="accent-olive"
              />
              {value === "retirada" ? `Retirar na loja (${store.name})` : "Quero entrega"}
            </label>
          ))}
        </div>
        {isDelivery && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {ADDRESS_FIELDS.map((field) => (
                <label key={field.name} className={`block space-y-1.5 text-sm font-medium ${"wide" in field ? "sm:col-span-2" : ""}`}>
                  {field.label}
                  {!field.required && <span className="font-normal text-cocoa-soft"> (opcional)</span>}
                  <input
                    name={field.name}
                    value={address[field.name]}
                    onChange={(e) => setAddress((a) => ({ ...a, [field.name]: e.target.value }))}
                    autoComplete={field.autoComplete}
                    maxLength={field.maxLength}
                    required={field.required}
                    aria-invalid={Boolean(errors[field.name])}
                    className="field-input"
                  />
                  <FieldError errors={errors} name={field.name} />
                </label>
              ))}
            </div>
            <p className="text-sm text-cocoa-soft">Campo Grande - MS. Entrega feita pela Juma Entregas.</p>
            {deliveryFee.status === "a_combinar" && (
              <p role="status" className="rounded-2xl bg-peach-light p-4 text-sm">
                Não conseguimos calcular a entrega para esse endereço agora. Você pode enviar o pedido e combinar a taxa no
                WhatsApp.
              </p>
            )}
            <input type="hidden" name="delivery_fee_seen" value={feeSeen} />
          </div>
        )}

        {quote?.has_made_to_order ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Data e horário</p>
            {days.length === 0 ? (
              <p className="text-sm text-raspberry">A loja não tem horários nos próximos dias. Fale com ela pelo WhatsApp.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  aria-label="Dia"
                  value={selectedDay?.date ?? ""}
                  onChange={(e) => {
                    setDay(e.target.value);
                    setSlot("");
                  }}
                  className="field-input"
                >
                  {days.map((d) => (
                    <option key={d.date} value={d.date}>
                      {formatWeekdayDate(d.date)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Horário"
                  name="scheduled_for"
                  value={slot || selectedDay?.slots[0]?.iso || ""}
                  onChange={(e) => setSlot(e.target.value)}
                  aria-invalid={Boolean(errors.scheduled_for)}
                  className="field-input"
                >
                  {selectedDay?.slots.map((s) => (
                    <option key={s.iso} value={s.iso}>
                      {s.time}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <FieldError errors={errors} name="scheduled_for" />
          </div>
        ) : (
          <p className="rounded-2xl bg-peach-light p-4 text-sm">
            {isDelivery
              ? `Separamos seus itens da vitrine por até ${reservation}. Finalize no WhatsApp para a loja confirmar a entrega.`
              : `Separamos seus itens da vitrine. Retire em até ${reservation} depois de finalizar no WhatsApp.`}
          </p>
        )}
      </fieldset>

      <label className="block space-y-1.5 text-sm font-medium">
        Observações <span className="font-normal text-cocoa-soft">(opcional)</span>
        <textarea name="notes" rows={3} maxLength={500} className="field-input" />
      </label>

      <div className="space-y-2 rounded-2xl border border-cocoa/10 bg-white p-4 text-sm">
        <p>
          Usamos seu nome, WhatsApp e, se informados, endereço e CPF/CNPJ só para atender este pedido e emitir a nota. Na
          entrega, o endereço vai para a Juma Entregas, que calcula a taxa e faz a entrega. Para falar sobre seus dados,
          chame a loja no WhatsApp. <Link href="/privacidade" className="underline">Política de privacidade</Link>.
        </p>
        <label className="flex min-h-11 items-center gap-3 font-medium">
          <input type="checkbox" name="privacy" required className="size-5 accent-olive" />
          Li e concordo com o aviso de privacidade
        </label>
        <FieldError errors={errors} name="privacy" />
      </div>

      {message && (
        <p role="alert" className="rounded-2xl bg-raspberry/10 p-4 text-raspberry">
          {message} {needsCart && <Link href="/carrinho" className="underline">Revisar carrinho</Link>}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || loading || !quote || problems || feeLoading}
        className="btn w-full bg-olive text-linen hover:bg-olive-dark sm:w-auto"
      >
        {pending ? "Enviando…" : "Fazer pedido"}
      </button>
    </form>
  );
}
