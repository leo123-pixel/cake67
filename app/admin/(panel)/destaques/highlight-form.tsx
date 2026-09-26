"use client";

import { useTransition } from "react";
import { Field, FormMessage } from "@/components/admin/field";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { ImageField } from "@/components/admin/image-field";
import { SubmitButton } from "@/components/admin/submit-button";
import { isoToLocalInput } from "@/lib/datetime";
import type { Tables } from "@/lib/database.types";
import { HIGHLIGHT_SLOT_LABELS } from "@/lib/validators/highlight";
import { deleteHighlight, saveHighlight } from "./actions";

type ProductChoice = { id: string; name: string; active: boolean; price_pending: boolean };

type Props = {
  highlight?: Tables<"highlights">;
  products: ProductChoice[];
};

export function HighlightForm({ highlight, products }: Props) {
  const [state, action, round] = useAdminForm(saveHighlight.bind(null, highlight?.id ?? null), { ok: false });
  const [deleting, startDelete] = useTransition();
  const echoed = state.values;
  const text = (key: string, saved: string | null | undefined) => (echoed ? String(echoed[key] ?? "") : (saved ?? ""));
  const date = (key: "starts_at" | "ends_at") => text(key, highlight?.[key] ? isoToLocalInput(highlight[key]) : "");
  const errors = state.fieldErrors ?? {};

  function onDelete() {
    if (!highlight || !window.confirm("Excluir este destaque?")) return;
    startDelete(async () => {
      await deleteHighlight(highlight.id);
    });
  }

  return (
    <form key={round} action={action} className="space-y-6">
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Espaço na home" name="slot" errors={errors.slot}>
          <select id="slot" name="slot" defaultValue={text("slot", highlight?.slot ?? "bolo_do_mes")} className="field-input">
            {Object.entries(HIGHLIGHT_SLOT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Produto vinculado" name="product_id" errors={errors.product_id} hint="Opcional. Sem imagem própria, usa a foto dele.">
          <select id="product_id" name="product_id" defaultValue={text("product_id", highlight?.product_id)} className="field-input">
            <option value="">Nenhum</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
                {!product.active ? " (inativo)" : product.price_pending ? " (preço a definir)" : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Título" name="title" errors={errors.title}>
        <input id="title" name="title" required defaultValue={text("title", highlight?.title)} className="field-input" />
      </Field>
      <Field label="Subtítulo" name="subtitle" errors={errors.subtitle}>
        <input id="subtitle" name="subtitle" defaultValue={text("subtitle", highlight?.subtitle)} className="field-input" />
      </Field>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Imagem própria</p>
        <ImageField
          name="image_path"
          folder="highlights"
          defaultPath={echoed ? (echoed.image_path as string) || null : (highlight?.image_path ?? null)}
          error={errors.image_path?.[0]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Texto do botão" name="cta_label" errors={errors.cta_label}>
          <input id="cta_label" name="cta_label" placeholder="Encomendar" defaultValue={text("cta_label", highlight?.cta_label)} className="field-input" />
        </Field>
        <Field label="Link do botão" name="cta_href" errors={errors.cta_href} hint="Ex. /cardapio ou https://…">
          <input id="cta_href" name="cta_href" defaultValue={text("cta_href", highlight?.cta_href)} className="field-input" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Começa em" name="starts_at" errors={errors.starts_at} hint="Vazio = já começa">
          <input id="starts_at" name="starts_at" type="datetime-local" defaultValue={date("starts_at")} className="field-input" />
        </Field>
        <Field label="Termina em" name="ends_at" errors={errors.ends_at} hint="Vazio = sem data para sair">
          <input id="ends_at" name="ends_at" type="datetime-local" defaultValue={date("ends_at")} className="field-input" />
        </Field>
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={echoed ? echoed.active === "on" : (highlight?.active ?? true)}
          className="size-5 accent-olive"
        />
        Ativo
      </label>

      <div className="flex flex-wrap gap-3">
        <SubmitButton>{highlight ? "Salvar destaque" : "Criar destaque"}</SubmitButton>
        {highlight && (
          <button type="button" onClick={onDelete} disabled={deleting} className="btn btn-danger">
            {deleting ? "Excluindo…" : "Excluir"}
          </button>
        )}
      </div>
    </form>
  );
}
