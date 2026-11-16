"use client";

import { Field, FormMessage } from "@/components/admin/field";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { HoursEditor } from "@/components/admin/hours-editor";
import { SubmitButton } from "@/components/admin/submit-button";
import type { AdminStore } from "@/lib/admin/catalog";
import type { JumaCategories } from "@/lib/delivery/quote";
import { deliverySetupProblem, SETUP_PROBLEM_TEXT } from "@/lib/delivery/setup";
import { formatWhatsapp } from "@/lib/phone";
import { parseStoredHours } from "@/lib/validators/store";
import { saveStore } from "./actions";

// Each sector has its own number (spec 08).
const WHATSAPP_FIELDS = [
  { name: "whatsapp_ready", label: "WhatsApp · Pronta entrega", hint: "Recebe pedidos só da vitrine" },
  { name: "whatsapp_made_to_order", label: "WhatsApp · Encomenda", hint: "Recebe pedidos com bolo, cento ou kit" },
  { name: "whatsapp_support", label: "WhatsApp · SAC", hint: "Único número mostrado no site" },
] as const;

// Stage 11: origin of the delivery and the Juma category (spec 11, D6/D7).
const ADDRESS_FIELDS = [
  { name: "address_street", label: "Rua", maxLength: 120 },
  { name: "address_number", label: "Número", maxLength: 20 },
  { name: "address_district", label: "Bairro", maxLength: 80 },
] as const;

// Stage 12: whether the InfinitePay account has its key on the server, and
// which variable holds it (the key itself never reaches the panel).
type PaymentSetup = { ready: boolean; keyVariable: string | null };

type Props = { store?: AdminStore; categories: JumaCategories; hasCredentials: boolean; payment?: PaymentSetup };

export function StoreForm({ store, categories, hasCredentials, payment }: Props) {
  const [state, action, round] = useAdminForm(saveStore.bind(null, store?.id ?? null), { ok: false });
  const echoed = state.values;
  const text = (key: string, saved: string) => (echoed ? String(echoed[key] ?? "") : saved);
  const errors = state.fieldErrors ?? {};

  return (
    <form key={round} action={action} className="space-y-8">
      <FormMessage state={state} />
      <fieldset className="space-y-4">
        <legend className="mb-2 text-xl text-olive">Dados</legend>
        <Field label="Nome" name="name" errors={errors.name}>
          <input id="name" name="name" required defaultValue={text("name", store?.name ?? "")} className="field-input" />
        </Field>
        <Field label="Endereço" name="address" errors={errors.address}>
          <input id="address" name="address" required defaultValue={text("address", store?.address ?? "")} className="field-input" />
        </Field>
        <Field label="Telefone" name="phone" errors={errors.phone}>
          <input id="phone" name="phone" type="tel" defaultValue={text("phone", store?.phone ?? "")} className="field-input" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          {WHATSAPP_FIELDS.map(({ name, label, hint }) => (
            <Field key={name} label={label} name={name} errors={errors[name]} hint={hint}>
              <input
                id={name}
                name={name}
                type="tel"
                inputMode="tel"
                required
                defaultValue={text(name, store ? formatWhatsapp(store[name]) : "")}
                aria-invalid={Boolean(errors[name])}
                className="field-input"
              />
            </Field>
          ))}
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={echoed ? echoed.active === "on" : (store?.active ?? true)}
            className="size-5 accent-olive"
          />
          Loja ativa (aparece no site)
        </label>
      </fieldset>

      <DeliverySection store={store} categories={categories} hasCredentials={hasCredentials} text={text} errors={errors} />

      <fieldset className="space-y-4">
        <legend className="mb-2 text-xl text-olive">Pagamento online (InfinitePay)</legend>
        <p className="text-sm text-cocoa-soft">
          Conta InfinitePay do CNPJ desta loja. Pedidos só de vitrine (retirada ou entrega com taxa calculada) podem ser
          pagos no site com Pix ou cartão; encomendas continuam no WhatsApp.
        </p>
        {store && (
          <p
            role="status"
            className={`rounded-xl px-4 py-3 text-sm ${payment?.ready ? "bg-olive/10 text-olive-dark" : "bg-peach text-cocoa"}`}
          >
            {payment?.ready
              ? "Ativo: o site oferece “Pagar agora”."
              : payment?.keyVariable
                ? `Sem chave no servidor: cadastre ${payment.keyVariable} nas variáveis da Vercel. Até lá, só WhatsApp.`
                : "Desligado: só WhatsApp."}
          </p>
        )}
        <Field
          label="InfiniteTag"
          name="payment_handle"
          errors={errors.payment_handle}
          hint="Sem o $, como aparece no app InfinitePay. Vazio desliga o pagamento online."
        >
          <input
            id="payment_handle"
            name="payment_handle"
            autoComplete="off"
            maxLength={41}
            defaultValue={text("payment_handle", store?.payment_handle ?? "")}
            aria-invalid={Boolean(errors.payment_handle)}
            className="field-input"
          />
        </Field>
      </fieldset>

      <HoursEditor hours={parseStoredHours(store?.hours)} echoed={echoed} errors={errors} />

      <SubmitButton className="btn btn-primary w-full sm:w-auto">{store ? "Salvar loja" : "Criar loja"}</SubmitButton>
    </form>
  );
}

type SectionProps = Props & {
  text: (key: string, saved: string) => string;
  errors: Record<string, string[] | undefined>;
};

function DeliverySection({ store, categories, hasCredentials, text, errors }: SectionProps) {
  const saved = store?.delivery_category_id ? `${store.delivery_category_id}|${store.delivery_category_name ?? ""}` : "";
  const selected = text("delivery_category", saved);
  const options = categories.status === "ok" ? categories.categories.map((c) => ({ value: `${c.id}|${c.name}`, label: c.name })) : [];
  // The saved category stays selectable even if Juma did not answer or no longer lists it.
  if (saved && !options.some((o) => o.value === saved)) {
    options.unshift({ value: saved, label: `${store?.delivery_category_name ?? store?.delivery_category_id} (salva)` });
  }
  const problem = store ? deliverySetupProblem(store, hasCredentials) : null;

  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 text-xl text-olive">Entrega pela Juma</legend>
      <p className="text-sm text-cocoa-soft">
        Endereço de onde sai a entrega e a categoria usada no cálculo da taxa. Cidade: Campo Grande - MS.
      </p>
      {store && (
        <p
          role="status"
          className={`rounded-xl px-4 py-3 text-sm ${problem ? "bg-peach text-cocoa" : "bg-olive/10 text-olive-dark"}`}
        >
          {problem ? `Entrega com taxa a combinar (Juma não configurada): ${SETUP_PROBLEM_TEXT[problem]}.` : "Juma configurada: a taxa é calculada no site."}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {ADDRESS_FIELDS.map(({ name, label, maxLength }) => (
          <Field key={name} label={label} name={name} errors={errors[name]}>
            <input
              id={name}
              name={name}
              maxLength={maxLength}
              defaultValue={text(name, store?.[name] ?? "")}
              aria-invalid={Boolean(errors[name])}
              className="field-input"
            />
          </Field>
        ))}
      </div>
      <Field
        label="Categoria da Juma"
        name="delivery_category"
        errors={errors.delivery_category}
        hint={
          categories.status === "failed"
            ? "A Juma não respondeu agora; a categoria salva continua valendo. Recarregue para tentar de novo."
            : categories.status === "no_credentials"
              ? "Sem as chaves da Juma no servidor não dá para listar as categorias."
              : "Lista vinda da Juma."
        }
      >
        <select id="delivery_category" name="delivery_category" defaultValue={selected} className="field-input">
          <option value="">Nenhuma (taxa a combinar)</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
    </fieldset>
  );
}
