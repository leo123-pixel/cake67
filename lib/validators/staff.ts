import { z } from "zod";
import { optionalUuid, requiredText } from "./common";

const staffFields = {
  name: requiredText("Informe o nome"),
  role: z.enum(["admin", "atendente"], { error: "Escolha o perfil" }),
  store_id: optionalUuid,
};

function requireStoreForAttendant(
  staff: { role: "admin" | "atendente"; store_id: string | null },
  ctx: z.RefinementCtx,
) {
  if (staff.role === "atendente" && !staff.store_id) {
    ctx.addIssue({ code: "custom", path: ["store_id"], message: "Atendente precisa de uma loja" });
  }
}

// Admins are not tied to a store.
const clearAdminStore = <T extends { role: string; store_id: string | null }>(staff: T): T => ({
  ...staff,
  store_id: staff.role === "admin" ? null : staff.store_id,
});

export const staffUpdateSchema = z
  .object(staffFields)
  .superRefine(requireStoreForAttendant)
  .transform(clearAdminStore);

export const staffInviteSchema = z
  .object({
    ...staffFields,
    email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido")),
  })
  .superRefine(requireStoreForAttendant)
  .transform(clearAdminStore);
