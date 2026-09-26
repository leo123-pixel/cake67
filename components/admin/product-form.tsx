"use client";

import { useActionState, useState } from "react";
import { saveProduct } from "@/app/admin/(panel)/produtos/actions";
import { Field, FormMessage } from "@/components/admin/field";
import { MoneyInput } from "@/components/admin/money-input";
import { SubmitButton } from "@/components/admin/submit-button";
import type { Enums, Tables } from "@/lib/database.types";
import type { ProductFormOptions } from "@/lib/admin/products";
import { centsToInput } from "@/lib/money";

type ProductType = Enums<"product_type">;

const TYPE_LABELS: Record<ProductType, string> = {
  vitrine: "Vitrine (pronta entrega)",
  bolo_kg: "Bolo por kg (encomenda)",
  cento: "Cento (encomenda)",
  kit: "Kit festa (encomenda)",
};

const PRICE_LABELS: Record<ProductType, string> = {
  vitrine: "Preço unitário",
  bolo_kg: "Preço por kg",
  cento: "Preço do cento",
  kit: "Preço do kit",
};

const WEIGHT_OPTIONS = Array.from({ length: 15 }, (_, i) => String(1 + i * 0.5));
const DEFAULT_FORMATS = "Redondo, Retangular, Régua";

type Props = {
  product?: Tables<"products">;
  addonIds?: string[];
  options: ProductFormOptions;
};

export function ProductForm({ product, addonIds = [], options }: Props) {
  const [state, action] = useActionState(saveProduct.bind(null, product?.id ?? null), { ok: false });

  // Echoed values after a failed submit win over the saved product.
  const echoed = state.values;
  const text = (key: string, saved: string) => (echoed ? String(echoed[key] ?? "") : saved);
  const list = (key: string, saved: string[]) => (echoed ? ((echoed[key] as string[]) ?? []) : saved);
  const checked = (key: string, saved: boolean) => (echoed ? echoed[key] === "on" : saved);
  const errors = state.fieldErrors ?? {};

  const [type, setType] = useState<ProductType>(
    (echoed?.type as ProductType | undefined) ?? product?.type ?? "vitrine",
  );

  const storeIds = list("store_ids", product?.store_ids ?? []);
  const weights = list("weights_kg", product?.weights_kg.length ? product.weights_kg.map(String) : WEIGHT_OPTIONS);
  // A pending price saved as 0 shows an empty field instead of "0,00".
  const savedPrice =
    product && !(product.price_pending && product.price_cents === 0) ? centsToInput(product.price_cents) : "";
  const chosenAddons = list("addon_ids", addonIds);
  const leadTime = text("lead_time_hours", String(product?.lead_time_hours ?? 48));
  const visibleAddons = options.addons.filter((addon) => addon.active || chosenAddons.includes(addon.id));

  return (
    <form action={action} className="space-y-8">
      <FormMessage state={state} />

      <fieldset className="space-y-4">
        <legend className="mb-2 text-xl text-olive">Dados</legend>
        <Field label="Nome" name="name" errors={errors.name}>
          <input
            id="name"
            name="name"
            required
            defaultValue={text("name", product?.name ?? "")}
            aria-invalid={Boolean(errors.name)}
            className="field-input"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria" name="category_id" errors={errors.category_id}>
            <select
              id="category_id"
              name="category_id"
              required
              defaultValue={text("category_id", product?.category_id ?? "")}
              aria-invalid={Boolean(errors.category_id)}
              className="field-input"
            >
              <option value="" disabled>
                Escolha…
              </option>
              {options.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo" name="type" errors={errors.type}>
            <select
              id="type"
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as ProductType)}
              className="field-input"
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Descrição" name="description" errors={errors.description}>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={text("description", product?.description ?? "")}
            className="field-input"
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-xl text-olive">Preço</legend>
        <Field label={PRICE_LABELS[type]} name="price" errors={errors.price}>
          <MoneyInput
            name="price"
            defaultValue={text("price", savedPrice)}
            invalid={Boolean(errors.price)}
          />
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="price_pending"
            defaultChecked={checked("price_pending", product?.price_pending ?? false)}
            className="size-5 accent-olive"
          />
          Preço a definir (o produto não aparece no site enquanto marcado)
        </label>
      </fieldset>

      {type === "bolo_kg" && (
        <fieldset className="space-y-4">
          <legend className="mb-2 text-xl text-olive">Encomenda de bolo</legend>
          <div className="space-y-2">
            <p className="text-sm font-medium">Pesos oferecidos</p>
            <div className="flex flex-wrap gap-2">
              {WEIGHT_OPTIONS.map((weight) => (
                <label key={weight} className="flex min-h-11 items-center gap-2 rounded-full border border-cocoa/15 bg-white px-3 text-sm has-checked:border-olive has-checked:bg-olive/10">
                  <input type="checkbox" name="weights_kg" value={weight} defaultChecked={weights.includes(weight)} className="accent-olive" />
                  {weight.replace(".", ",")} kg
                </label>
              ))}
            </div>
            {errors.weights_kg && <p className="text-sm text-raspberry">{errors.weights_kg[0]}</p>}
          </div>
          <Field label="Formatos" name="formats" errors={errors.formats} hint="Separe por vírgula">
            <input
              id="formats"
              name="formats"
              defaultValue={text("formats", product?.formats.length ? product.formats.join(", ") : DEFAULT_FORMATS)}
              className="field-input"
            />
          </Field>
          {visibleAddons.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Adicionais aceitos</p>
              <div className="flex flex-wrap gap-2">
                {visibleAddons.map((addon) => (
                  <label key={addon.id} className="flex min-h-11 items-center gap-2 rounded-full border border-cocoa/15 bg-white px-3 text-sm has-checked:border-olive has-checked:bg-olive/10">
                    <input type="checkbox" name="addon_ids" value={addon.id} defaultChecked={chosenAddons.includes(addon.id)} className="accent-olive" />
                    {addon.name}
                    {!addon.active && <span className="text-cocoa-soft">(desativado)</span>}
                  </label>
                ))}
              </div>
            </div>
          )}
        </fieldset>
      )}

      {type === "cento" && (
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-xl text-olive">Encomenda por cento</legend>
          <Field label="Quantidade mínima" name="min_qty" errors={errors.min_qty}>
            <input id="min_qty" name="min_qty" type="number" min={1} defaultValue={text("min_qty", String(product?.min_qty ?? 25))} className="field-input" />
          </Field>
          <Field label="Aumenta de quanto em quanto" name="step_qty" errors={errors.step_qty}>
            <input id="step_qty" name="step_qty" type="number" min={1} defaultValue={text("step_qty", String(product?.step_qty ?? 25))} className="field-input" />
          </Field>
        </fieldset>
      )}

      {type === "kit" && (
        <fieldset className="space-y-4">
          <legend className="mb-2 text-xl text-olive">Kit festa</legend>
          <Field label="O que vem no kit" name="kit_contents" errors={errors.kit_contents}>
            <textarea id="kit_contents" name="kit_contents" rows={3} defaultValue={text("kit_contents", product?.kit_contents ?? "")} className="field-input" />
          </Field>
        </fieldset>
      )}

      {type !== "vitrine" && (
        <Field label="Antecedência mínima (horas)" name="lead_time_hours" errors={errors.lead_time_hours}>
          <input id="lead_time_hours" name="lead_time_hours" type="number" min={0} step={1} defaultValue={leadTime} className="field-input sm:max-w-40" />
        </Field>
      )}

      <fieldset className="space-y-3">
        <legend className="mb-2 text-xl text-olive">Disponibilidade</legend>
        <p className="text-sm text-cocoa-soft">Lojas que vendem este produto. Nenhuma marcada = todas.</p>
        <div className="flex flex-wrap gap-2">
          {options.stores.map((store) => (
            <label key={store.id} className="flex min-h-11 items-center gap-2 rounded-full border border-cocoa/15 bg-white px-3 text-sm has-checked:border-olive has-checked:bg-olive/10">
              <input type="checkbox" name="store_ids" value={store.id} defaultChecked={storeIds.includes(store.id)} className="accent-olive" />
              {store.name}
            </label>
          ))}
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="active" defaultChecked={checked("active", product?.active ?? true)} className="size-5 accent-olive" />
          Mostrar no site
        </label>
      </fieldset>

      <div className="sticky bottom-0 -mx-4 border-t border-cocoa/10 bg-linen/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <SubmitButton className="btn btn-primary w-full sm:w-auto">{product ? "Salvar produto" : "Criar produto"}</SubmitButton>
      </div>
    </form>
  );
}
