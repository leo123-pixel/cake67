// Small browser-only helpers for the prototype interactions (toast, "fly to
// cart", choosing a cake from the showcase). Call them from event handlers.

export const TOAST_EVENT = "cake67:toast";
export const PICK_CAKE_EVENT = "cake67:pick-cake";
export const CART_BUTTON_ID = "cart-button";

export function showToast(text: string) {
  window.dispatchEvent(new CustomEvent<string>(TOAST_EVENT, { detail: text }));
}

export function pickCake(cakeId: string) {
  window.dispatchEvent(new CustomEvent<string>(PICK_CAKE_EVENT, { detail: cakeId }));
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scrollToId(id: string, block: ScrollLogicalPosition = "start") {
  document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block });
}

// The product photo flies from where it was tapped to the "Pedido" button.
export function flyToCart(from: Element | null, src: string) {
  const target = document.getElementById(CART_BUTTON_ID);
  if (!from || !target || prefersReducedMotion()) return;
  const start = from.getBoundingClientRect();
  const end = target.getBoundingClientRect();
  const image = document.createElement("img");
  image.src = src;
  image.alt = "";
  image.className = "ck-fly";
  image.style.left = `${start.left + start.width / 2 - 32}px`;
  image.style.top = `${start.top + start.height / 2 - 32}px`;
  document.body.append(image);
  requestAnimationFrame(() => {
    const dx = end.left + end.width / 2 - (start.left + start.width / 2);
    const dy = end.top + end.height / 2 - (start.top + start.height / 2);
    image.style.transform = `translate(${dx}px, ${dy}px) scale(.25)`;
    image.style.opacity = ".4";
  });
  window.setTimeout(() => image.remove(), 750);
}
