"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { ActionState } from "@/lib/validators/common";

export type MenuAction =
  | { label: string; href: string }
  | {
      label: string;
      run: () => Promise<ActionState | void> | void;
      // Asked with window.confirm before running (destructive actions).
      confirm?: string;
      danger?: boolean;
    };

type Props = { label: string; actions: MenuAction[] };

// ~6 items of 44 px plus padding.
const MENU_HEIGHT_ESTIMATE = 300;

const ITEM = "flex min-h-11 w-full items-center px-4 text-left text-sm hover:bg-olive/10 disabled:opacity-50";

// "Ações" button with a dropdown. Results that fail show under the button.
export function ActionsMenu({ label, actions }: Props) {
  const [open, setOpen] = useState(false);
  const [upward, setUpward] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function select(action: Extract<MenuAction, { run: unknown }>) {
    if (action.confirm && !window.confirm(action.confirm)) return;
    setOpen(false);
    setMessage(null);
    startTransition(async () => {
      const result = await action.run();
      if (result && !result.ok) setMessage(result.message ?? "Não foi possível concluir. Tente de novo.");
    });
  }

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Ações de ${label}`}
        disabled={pending}
        onClick={(event) => {
          // Open upward near the bottom of the screen so items stay reachable.
          const spaceBelow = window.innerHeight - event.currentTarget.getBoundingClientRect().bottom;
          setUpward(spaceBelow < MENU_HEIGHT_ESTIMATE);
          setOpen((value) => !value);
        }}
        className="btn btn-secondary min-h-11 px-4"
      >
        {pending ? "Aguarde…" : "Ações"}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={`absolute right-0 z-30 w-56 overflow-hidden rounded-xl border border-cocoa/10 bg-white py-1 shadow-lg ${
            upward ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {actions.map((action) =>
            "href" in action ? (
              <Link key={action.label} role="menuitem" href={action.href} className={ITEM}>
                {action.label}
              </Link>
            ) : (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                onClick={() => select(action)}
                className={`${ITEM} ${action.danger ? "text-raspberry" : ""}`}
              >
                {action.label}
              </button>
            ),
          )}
        </div>
      )}
      {message && (
        <p role="alert" className="mt-1 max-w-64 text-xs text-raspberry">
          {message}
        </p>
      )}
    </div>
  );
}
