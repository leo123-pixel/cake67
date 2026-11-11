// Checks the Juma (Machine) login and an estimate, without calling a courier.
//   npm run juma:check
//     lists the categories (checks key + login)
//   npm run juma:check -- "Rua Estiva" 200 "<bairro da loja>" "<rua>" <número> "<bairro>" [categoria]
//     also estimates from the store to the address (Campo Grande - MS);
//     category defaults to the first one Juma lists.
// Prints only results; the key and password never show up.
import { estimateDelivery, listCategories, readMachineConfig } from "../lib/delivery/machine";

async function main() {
  const config = readMachineConfig();
  if (!config) {
    console.error("Faltam variáveis no .env.local: MACHINE_API_URL, MACHINE_API_KEY, MACHINE_USERNAME, MACHINE_PASSWORD.");
    process.exit(1);
  }
  console.log(`API: ${config.url}`);

  const categories = await listCategories(config);
  if (!categories.ok) {
    console.error(`Categorias: falhou (${categories.error})`);
    process.exit(1);
  }
  console.log("Categorias:");
  for (const c of categories.categories) console.log(`  ${c.id}  ${c.name}`);

  const args = process.argv.slice(2);
  if (args.length < 6) {
    console.log('Para estimar: npm run juma:check -- "Rua da loja" número "Bairro da loja" "Rua" número "Bairro" [categoria]');
    return;
  }
  const [fromStreet, fromNumber, fromDistrict, street, number, district, category = categories.categories[0]?.id] = args;
  if (!category) {
    console.error("A Juma não devolveu nenhuma categoria.");
    process.exit(1);
  }
  const from = { street: fromStreet, number: fromNumber, district: fromDistrict };
  const result = await estimateDelivery(config, from, { street, number, district }, category);
  if (!result.ok) {
    console.error(`Estimativa: falhou (${result.error})`);
    process.exit(1);
  }
  console.log(
    `Estimativa (categoria ${category}) de ${from.street}, ${from.number} até ${street}, ${number} - ${district}: ` +
      `R$ ${(result.feeCents / 100).toFixed(2).replace(".", ",")} · ${result.km ?? "?"} km · ${result.minutes ?? "?"} min`,
  );
}

main();
