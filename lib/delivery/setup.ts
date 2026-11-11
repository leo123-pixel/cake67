// What a store needs for Juma to calculate the delivery fee (spec 11, D6/D7).
export type StoreDeliverySetup = {
  address_street: string | null;
  address_number: string | null;
  address_district: string | null;
  delivery_category_id: string | null;
};

export type DeliverySetupProblem = "credentials" | "address" | "category";

// What is missing for Juma to calculate the fee of a store (null = ready).
export function deliverySetupProblem(store: StoreDeliverySetup, hasCredentials: boolean): DeliverySetupProblem | null {
  if (!hasCredentials) return "credentials";
  if (!store.address_street?.trim() || !store.address_number?.trim() || !store.address_district?.trim()) return "address";
  if (!store.delivery_category_id) return "category";
  return null;
}

export const SETUP_PROBLEM_TEXT: Record<DeliverySetupProblem, string> = {
  credentials: "as chaves da Juma não estão no servidor (variáveis MACHINE_API_URL, MACHINE_API_KEY, MACHINE_USERNAME e MACHINE_PASSWORD)",
  address: "falta a rua, o número ou o bairro da loja",
  category: "falta escolher a categoria da Juma",
};
