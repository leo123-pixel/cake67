"use client";

import { useRef, useState } from "react";
import { Field, FormMessage } from "@/components/admin/field";
import { SubmitButton } from "@/components/admin/submit-button";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { FieldErrors } from "@/lib/validators/common";
import { describeTemplateProblems, RESERVATION_RANGE } from "@/lib/validators/settings";
import {
  CONFIRMATION_TEMPLATE,
  ORDER_TEMPLATE,
  renderConfirmationMessage,
  renderOrderMessage,
  SAMPLE_ORDER,
  type TemplateSpec,
} from "@/lib/whatsapp";
import { saveSettings } from "./actions";

export type SettingsValues = {
  reservation_minutes: number;
  order_whatsapp_template: string;
  confirmation_whatsapp_template: string;
  privacy_text: string;
  privacy_reviewed: boolean;
};

const SAMPLE_LINK = "https://cake67.vercel.app/pedido/C67-000123?t=…";

export function SettingsForm({ settings }: { settings: SettingsValues }) {
  const [state, action, round] = useAdminForm(saveSettings);
  const echoed = state.values;
  const initial: SettingsValues = echoed
    ? {
        reservation_minutes: Number(echoed.reservation_minutes) || settings.reservation_minutes,
        order_whatsapp_template: String(echoed.order_whatsapp_template ?? ""),
        confirmation_whatsapp_template: String(echoed.confirmation_whatsapp_template ?? ""),
        privacy_text: String(echoed.privacy_text ?? ""),
        privacy_reviewed: echoed.privacy_reviewed === "on",
      }
    : settings;

  return (
    // Keyed by round: the fields below remount with what was saved or echoed.
    <form key={round} action={action} className="space-y-10">
      <FormMessage state={state} />
      <SettingsFields initial={initial} errors={state.fieldErrors ?? {}} />
      <SubmitButton className="btn btn-primary w-full sm:w-auto">Salvar configurações</SubmitButton>
    </form>
  );
}

function SettingsFields({ initial, errors }: { initial: SettingsValues; errors: FieldErrors }) {
  const [reservation, setReservation] = useState(String(initial.reservation_minutes));
  const [reviewed, setReviewed] = useState(initial.privacy_reviewed);
  const minutes = Number(reservation) >= RESERVATION_RANGE.min ? Number(reservation) : 120;

  return (
    <>
      <fieldset className="space-y-4">
        <legend className="mb-2 text-xl text-olive">Reserva da vitrine</legend>
        <Field
          label="Tempo para o cliente retirar (minutos)"
          name="reservation_minutes"
          errors={errors.reservation_minutes}
          hint={`Entre ${RESERVATION_RANGE.min} e ${RESERVATION_RANGE.max}. Pedido não confirmado nesse tempo expira e devolve o estoque. Vale para pedidos novos.`}
        >
          <input
            id="reservation_minutes"
            name="reservation_minutes"
            type="number"
            inputMode="numeric"
            min={RESERVATION_RANGE.min}
            max={RESERVATION_RANGE.max}
            required
            value={reservation}
            onChange={(event) => setReservation(event.target.value)}
            aria-invalid={Boolean(errors.reservation_minutes)}
            className="field-input sm:w-40"
          />
        </Field>
      </fieldset>

      <TemplateEditor
        legend="Mensagem do pedido"
        intro="Texto que o cliente envia para a loja ao concluir o pedido."
        name="order_whatsapp_template"
        spec={ORDER_TEMPLATE}
        initial={initial.order_whatsapp_template}
        errors={errors.order_whatsapp_template}
        preview={(template) => renderOrderMessage(template, SAMPLE_ORDER, minutes)}
      />

      <TemplateEditor
        legend="Mensagem de confirmação"
        intro="Texto que o atendente envia ao cliente quando confirma o pedido. Não mostra valores."
        name="confirmation_whatsapp_template"
        spec={CONFIRMATION_TEMPLATE}
        initial={initial.confirmation_whatsapp_template}
        errors={errors.confirmation_whatsapp_template}
        preview={(template) => renderConfirmationMessage(template, SAMPLE_ORDER, SAMPLE_LINK)}
      />

      <fieldset className="space-y-4">
        <legend className="mb-2 flex items-center gap-3 text-xl text-olive">
          Política de privacidade
          {!reviewed && <span className="rounded-full bg-peach px-3 py-1 text-xs font-medium text-cocoa">Texto provisório</span>}
        </legend>
        <Field
          label="Texto da página /privacidade"
          name="privacy_text"
          errors={errors.privacy_text}
          hint="Deixe uma linha em branco entre os parágrafos."
        >
          <textarea
            id="privacy_text"
            name="privacy_text"
            rows={14}
            maxLength={20000}
            defaultValue={initial.privacy_text}
            className="field-input text-sm"
          />
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="privacy_reviewed"
            checked={reviewed}
            onChange={(event) => setReviewed(event.target.checked)}
            className="size-5 accent-olive"
          />
          Texto revisado pela Cake 67 (tira o selo &quot;Texto provisório&quot; do site)
        </label>
      </fieldset>
    </>
  );
}

type TemplateEditorProps = {
  legend: string;
  intro: string;
  name: string;
  spec: TemplateSpec;
  initial: string;
  errors: string[] | undefined;
  preview: (template: string) => string;
};

function TemplateEditor({ legend, intro, name, spec, initial, errors, preview }: TemplateEditorProps) {
  const [template, setTemplate] = useState(initial);
  const templateRef = useRef<HTMLTextAreaElement>(null);
  const problem = describeTemplateProblems(template, spec);
  const variables = Object.entries(spec.variables);

  function insertVariable(variable: string) {
    const field = templateRef.current;
    const token = `{${variable}}`;
    const start = field?.selectionStart ?? template.length;
    const end = field?.selectionEnd ?? template.length;
    setTemplate(template.slice(0, start) + token + template.slice(end));
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 text-xl text-olive">{legend}</legend>
      <p className="text-sm text-cocoa-soft">{intro} Toque numa variável para inserir onde está o cursor.</p>
      <ul className="flex flex-wrap gap-2">
        {variables.map(([variable, description]) => (
          <li key={variable}>
            <button
              type="button"
              onClick={() => insertVariable(variable)}
              title={description}
              className="min-h-11 rounded-full border border-cocoa/15 bg-white px-3 text-sm hover:border-olive"
            >
              {`{${variable}}`}
              <span className="sr-only">: {description}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field
          label="Modelo"
          name={name}
          errors={errors ?? (problem ? [problem] : undefined)}
          hint={`Obrigatórias: ${spec.required.map((variable) => `{${variable}}`).join(" e ")}.`}
        >
          <textarea
            id={name}
            ref={templateRef}
            name={name}
            rows={10}
            maxLength={2000}
            required
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
            aria-invalid={Boolean(problem || errors)}
            className="field-input font-mono text-sm"
          />
        </Field>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Prévia com um pedido de exemplo</p>
          <p className="rounded-2xl bg-[#dcf8c6] p-4 text-sm whitespace-pre-line text-cocoa" aria-live="polite">
            {preview(template)}
          </p>
        </div>
      </div>
      <dl className="grid gap-x-4 gap-y-1 text-xs text-cocoa-soft sm:grid-cols-2">
        {variables.map(([variable, description]) => (
          <div key={variable}>
            <dt className="inline font-mono">{`{${variable}}`}</dt> <dd className="inline">{description}</dd>
          </div>
        ))}
      </dl>
    </fieldset>
  );
}
