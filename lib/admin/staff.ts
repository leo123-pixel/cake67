import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

async function listAuthUsers(admin: Client): Promise<User[]> {
  const users: User[] = [];
  const perPage = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < perPage) return users;
  }
}

export async function findAuthUserByEmail(admin: Client, email: string) {
  const users = await listAuthUsers(admin);
  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

// Staff rows (read with the admin's session) joined with auth e-mail and
// whether the person ever signed in (read with the service role).
export async function listTeam(supabase: Client, admin: Client) {
  const [{ data: staff, error }, users] = await Promise.all([
    supabase.from("staff").select("user_id, name, role, store_id, active, store:stores(name)").order("name"),
    listAuthUsers(admin),
  ]);
  if (error) throw new Error(`Could not load staff: ${error.message}`);

  const byId = new Map(users.map((user) => [user.id, user]));
  return staff.map(({ store, ...member }) => {
    const user = byId.get(member.user_id);
    return {
      ...member,
      storeName: store?.name ?? null,
      email: user?.email ?? "",
      invitePending: !user?.last_sign_in_at,
    };
  });
}

export type TeamMember = Awaited<ReturnType<typeof listTeam>>[number];
