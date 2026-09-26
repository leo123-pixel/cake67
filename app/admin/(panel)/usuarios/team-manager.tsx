"use client";

import { useActionState, useState, useTransition } from "react";
import { CopyLink } from "@/components/admin/copy-link";
import { Field, FormMessage } from "@/components/admin/field";
import { StatusBadge } from "@/components/admin/status-badge";
import { SubmitButton } from "@/components/admin/submit-button";
import type { TeamMember } from "@/lib/admin/staff";
import { generatePasswordLink, inviteMember, setMemberActive, updateMember } from "./actions";

type StoreOption = { id: string; name: string };

const LINK_MESSAGE = "Seu acesso ao painel da Cake 67. Abra o link para definir sua senha:";

function RoleAndStore({ prefix, role, storeId, stores, errors }: {
  prefix: string;
  role: string;
  storeId: string | null;
  stores: StoreOption[];
  errors: Record<string, string[]>;
}) {
  const [current, setCurrent] = useState(role);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Perfil" name={`${prefix}-role`} errors={errors.role}>
        <select id={`${prefix}-role`} name="role" value={current} onChange={(e) => setCurrent(e.target.value)} className="field-input">
          <option value="atendente">Atendente</option>
          <option value="admin">Administrador</option>
        </select>
      </Field>
      {current === "atendente" && (
        <Field label="Loja" name={`${prefix}-store`} errors={errors.store_id}>
          <select id={`${prefix}-store`} name="store_id" defaultValue={storeId ?? ""} className="field-input">
            <option value="">Escolha…</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}

function InviteForm({ stores }: { stores: StoreOption[] }) {
  const [state, action] = useActionState(inviteMember, { ok: false });
  const echoed = state.values;
  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-4 rounded-2xl border border-cocoa/10 bg-white p-4">
      <h2 className="text-xl text-olive">Convidar pessoa</h2>
      <form action={action} className="space-y-4">
        <FormMessage state={state} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" name="invite-name" errors={errors.name}>
            <input id="invite-name" name="name" required defaultValue={String(echoed?.name ?? "")} className="field-input" />
          </Field>
          <Field label="E-mail" name="invite-email" errors={errors.email}>
            <input id="invite-email" name="email" type="email" required defaultValue={String(echoed?.email ?? "")} className="field-input" />
          </Field>
        </div>
        <RoleAndStore
          prefix="invite"
          role={String(echoed?.role ?? "atendente")}
          storeId={(echoed?.store_id as string) || null}
          stores={stores}
          errors={errors}
        />
        <SubmitButton pendingText="Gerando convite…">Gerar convite</SubmitButton>
      </form>
      {state.ok && state.link && <CopyLink link={state.link} message={LINK_MESSAGE} />}
    </div>
  );
}

function MemberRow({ member, stores, isSelf }: { member: TeamMember; stores: StoreOption[]; isSelf: boolean }) {
  const [state, action] = useActionState(updateMember.bind(null, member.user_id), { ok: false });
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const prefix = `member-${member.user_id}`;

  function run(task: () => Promise<{ ok: boolean; message?: string; link?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await task();
      if (result.link) setLink(result.link);
      if (!result.ok) setMessage(result.message ?? "Não foi possível concluir.");
    });
  }

  return (
    <li className="space-y-4 rounded-2xl border border-cocoa/10 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">
          {member.name}
          {isSelf && " (você)"}
        </span>
        <span className="text-sm text-cocoa-soft">{member.email}</span>
        {!member.active && <StatusBadge tone="gray">Desativado</StatusBadge>}
        {member.active && member.invitePending && <StatusBadge tone="amber">Convite pendente</StatusBadge>}
      </div>

      <form action={action} className="space-y-3">
        <FormMessage state={state} />
        <Field label="Nome" name={`${prefix}-name`} errors={state.fieldErrors?.name}>
          <input id={`${prefix}-name`} name="name" defaultValue={member.name} required className="field-input" />
        </Field>
        <RoleAndStore
          prefix={prefix}
          role={member.role}
          storeId={member.store_id}
          stores={stores}
          errors={state.fieldErrors ?? {}}
        />
        <SubmitButton className="btn btn-secondary">Salvar</SubmitButton>
      </form>

      <div className="flex flex-wrap gap-2 border-t border-cocoa/10 pt-3">
        {member.active && (
          <button type="button" disabled={pending} onClick={() => run(() => generatePasswordLink(member.user_id))} className="btn btn-secondary">
            {member.invitePending ? "Gerar novo link de convite" : "Gerar link de nova senha"}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (member.active && !window.confirm(`Desativar ${member.name}? A pessoa perde o acesso.`)) return;
            run(() => setMemberActive(member.user_id, !member.active));
          }}
          className={member.active ? "btn btn-danger" : "btn btn-primary"}
        >
          {member.active ? "Desativar" : "Reativar"}
        </button>
      </div>
      {message && <p role="alert" className="text-sm text-raspberry">{message}</p>}
      {link && <CopyLink link={link} message={LINK_MESSAGE} />}
    </li>
  );
}

export function TeamManager({
  members,
  stores,
  currentUserId,
}: {
  members: TeamMember[];
  stores: StoreOption[];
  currentUserId: string;
}) {
  return (
    <div className="space-y-8">
      <InviteForm stores={stores} />
      <ul className="space-y-3">
        {members.map((member) => (
          <MemberRow key={member.user_id} member={member} stores={stores} isSelf={member.user_id === currentUserId} />
        ))}
      </ul>
    </div>
  );
}
