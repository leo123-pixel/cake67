"use client";

import { Field, FormMessage } from "@/components/admin/field";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { SortableList } from "@/components/admin/sortable-list";
import { StatusBadge } from "@/components/admin/status-badge";
import { SubmitButton } from "@/components/admin/submit-button";
import type { AdminCategory } from "@/lib/admin/catalog";
import { reorderItems } from "../reorder-action";
import { createCategory, updateCategory } from "./actions";

const KIND_LABELS = { vitrine: "Vitrine", encomenda: "Encomenda" } as const;

function KindSelect({ id, defaultValue }: { id: string; defaultValue?: string }) {
  return (
    <select id={id} name="kind" defaultValue={defaultValue ?? "vitrine"} className="field-input">
      <option value="vitrine">Vitrine (pronta entrega)</option>
      <option value="encomenda">Encomenda</option>
    </select>
  );
}

function NewCategoryForm() {
  const [state, action, round] = useAdminForm(createCategory, { ok: false });
  return (
    <form key={round} action={action} className="space-y-4 rounded-2xl border border-cocoa/10 bg-white p-4">
      <h2 className="text-xl text-olive">Nova categoria</h2>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" name="new-name" errors={state.fieldErrors?.name}>
          <input id="new-name" name="name" required className="field-input" />
        </Field>
        <Field label="Tipo" name="new-kind">
          <KindSelect id="new-kind" />
        </Field>
      </div>
      <SubmitButton>Criar categoria</SubmitButton>
    </form>
  );
}

function CategoryRow({ category }: { category: AdminCategory }) {
  const [state, action, round] = useAdminForm(updateCategory.bind(null, category.id), { ok: false });
  const prefix = `cat-${category.id}`;

  return (
    <form key={round} action={action} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge tone={category.active ? "green" : "gray"}>{category.active ? "Ativa" : "Inativa"}</StatusBadge>
        <span className="text-cocoa-soft">
          {KIND_LABELS[category.kind]} · {category.productCount} produto(s)
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <Field label="Nome" name={`${prefix}-name`} errors={state.fieldErrors?.name}>
          <input id={`${prefix}-name`} name="name" defaultValue={category.name} required className="field-input" />
        </Field>
        <Field label="Tipo" name={`${prefix}-kind`}>
          <KindSelect id={`${prefix}-kind`} defaultValue={category.kind} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={category.active} className="size-5 accent-olive" />
          Mostrar no site
        </label>
        <SubmitButton className="btn btn-secondary">Salvar</SubmitButton>
        {state.message && (
          <span role="status" className={`text-sm ${state.ok ? "text-olive" : "text-raspberry"}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

export function CategoriesManager({ categories }: { categories: AdminCategory[] }) {
  return (
    <div className="space-y-8">
      <NewCategoryForm />
      <SortableList
        items={categories}
        label={(category) => category.name}
        renderItem={(category) => <CategoryRow category={category} />}
        onReorder={(ids) => reorderItems("categories", ids)}
      />
    </div>
  );
}
