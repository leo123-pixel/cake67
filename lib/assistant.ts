// Home assistant (AD-012): rule-based answers built only from database data.
// It never invents a price, a deadline or availability; unknown → WhatsApp.
import { rangeText, sizeName, suggestCake } from "@/lib/cake";
import { formatBRL } from "@/lib/money";

export type AssistantData = {
  stores: { name: string; address: string; hours: string }[];
  vitrine: { storeName: string; items: { name: string; category: string; priceCents: number; available: boolean }[] }[];
  cakes: { name: string; priceCents: number | null; leadTimeHours: number; weightsKg: number[]; formats: string[] }[];
};

export type AssistantAction = "vitrine" | "calc" | "cfg" | "lojas";

export type AssistantAnswer = { text: string; action?: { target: AssistantAction; label: string }; whatsappText?: string };

export const ASSISTANT_SUGGESTIONS = ["Tem fatia hoje?", "Bolo para 30 pessoas", "Abre domingo?", "Qual o prazo?"];

export const ASSISTANT_GREETING = "Oi! Sou o assistente da Cake 67. Posso ajudar com sabores, preços, prazos e lojas.";

function availableIn(data: AssistantData, category: RegExp) {
  return data.vitrine
    .map((store) => ({
      storeName: store.storeName,
      items: store.items.filter((item) => item.available && category.test(item.category)),
    }))
    .filter((store) => store.items.length > 0);
}

function vitrineAnswer(data: AssistantData, category: RegExp, label: string, extra = ""): AssistantAnswer {
  const stores = availableIn(data, category);
  const action = { target: "vitrine" as const, label: "Ver a vitrine" };
  if (stores.length === 0) return { text: `${label} de hoje já acabaram nas lojas.${extra}`, action };
  const lines = stores.map(
    (store) => `${store.storeName}: ${store.items.map((item) => `${item.name} (${formatBRL(item.priceCents)})`).join(", ")}`,
  );
  return { text: `Hoje tem ${lines.join(" · ")}.${extra}`, action };
}

function guestsAnswer(data: AssistantData, question: string): AssistantAnswer {
  const action = { target: "calc" as const, label: "Abrir a calculadora" };
  const guests = Number(question.match(/\d+/)?.[0]);
  const weights = [...new Set(data.cakes.flatMap((cake) => cake.weightsKg))];
  const formats = [...new Set(data.cakes.flatMap((cake) => cake.formats))];
  const suggestion = suggestCake(guests, weights, formats);
  if (!suggestion) return { text: "Me diga quantas pessoas vão à festa e eu sugiro o peso e o formato.", action };
  const sizes = suggestion.options.map((o) => `${sizeName(o.size)} (${rangeText(o.size)})`).join(" ou ");
  return {
    text: `Para ${guests} pessoas sugiro ${sizes}: serve até ${suggestion.serves} fatias. Cobramos o peso mínimo e, se passar na pesagem, a diferença é paga na retirada.`,
    action,
  };
}

function leadTimeAnswer(data: AssistantData): AssistantAnswer {
  if (data.cakes.length === 0) return fallback("Qual o prazo para encomendar um bolo?");
  const hours = data.cakes.map((cake) => cake.leadTimeHours);
  const min = Math.min(...hours);
  const max = Math.max(...hours);
  const range = min === max ? `${min} h` : `de ${min} a ${max} h, conforme o bolo`;
  return { text: `Bolos sob encomenda precisam de ${range} de antecedência. A data você escolhe ao montar o bolo.`, action: { target: "cfg", label: "Montar meu bolo" } };
}

function hoursAnswer(data: AssistantData): AssistantAnswer {
  const lines = data.stores.map((store) => `${store.name}, ${store.address}: ${store.hours}`);
  return { text: `${lines.join(". ")}.`, action: { target: "lojas", label: "Ver lojas" } };
}

function priceAnswer(data: AssistantData): AssistantAnswer {
  const action = { target: "cfg" as const, label: "Montar meu bolo" };
  const priced = data.cakes.filter((cake): cake is typeof cake & { priceCents: number } => cake.priceCents !== null);
  if (priced.length === 0) {
    return { text: "Os preços dos bolos por kg chegam em breve. Enquanto isso, a loja passa o valor pelo WhatsApp.", action };
  }
  const list = priced.map((cake) => `${cake.name.replace(/^Bolo /, "")} ${formatBRL(cake.priceCents)}/kg`).join(", ");
  return { text: `Os bolos sob encomenda são vendidos por kg: ${list}. O total aparece na hora no configurador.`, action };
}

function fallback(question: string): AssistantAnswer {
  return {
    text: "Essa eu não sei com certeza. Posso passar sua pergunta para o WhatsApp da loja.",
    whatsappText: `Olá, Cake 67! ${question}`,
  };
}

const RULES: { match: RegExp; answer: (data: AssistantData, question: string) => AssistantAnswer }[] = [
  { match: /fatia|karen|cheesecake|vitrine/i, answer: (data) => vitrineAnswer(data, /fatia/i, "As fatias") },
  {
    match: /croissant/i,
    answer: (data) => vitrineAnswer(data, /croissant/i, "Os croissants", " Eles são montados na hora, em 12 a 15 minutos."),
  },
  { match: /convidad|pessoas|tamanho|quantos/i, answer: guestsAnswer },
  { match: /prazo|anteced|quando|data/i, answer: leadTimeAnswer },
  {
    match: /entrega|entregam|frete|taxa/i,
    answer: () => ({ text: "Dá para retirar numa das lojas ou pedir entrega. Taxa e endereço são combinados no WhatsApp da loja." }),
  },
  { match: /hor[áa]rio|abre|fecha|loja|endere|domingo|s[áa]bado/i, answer: hoursAnswer },
  {
    match: /pix|cart[ãa]o|pagamento|pagar/i,
    answer: () => ({ text: "O pagamento é combinado no WhatsApp da loja, depois que você envia o pedido pelo site." }),
  },
  { match: /pre[çc]o|quanto|valor|kg|custa/i, answer: priceAnswer },
];

export function answerQuestion(question: string, data: AssistantData): AssistantAnswer {
  const rule = RULES.find((r) => r.match.test(question));
  return rule ? rule.answer(data, question) : fallback(question.trim());
}
