"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/validators/common";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
type RoundState = ActionState & { round: number };

// React 19 resets a <form action> after each submit, but does not restore
// <select>/checkbox defaults that changed after mount. Keying the <form> by
// `round` (bumped on every response) remounts it with the current defaults:
// echoed values after an error, saved data after a success.
export function useAdminForm(action: Action, initial: ActionState = { ok: false }) {
  const [state, dispatch] = useActionState<RoundState, FormData>(
    async (prev, formData) => ({ ...(await action(prev, formData)), round: prev.round + 1 }),
    { ...initial, round: 0 },
  );
  return [state, dispatch, state.round] as const;
}
