"use client";

import { useState } from "react";

// Shows a one-time link with copy and "send via WhatsApp" (AD-007).
export function CopyLink({ link, message }: { link: string; message: string }) {
  const [copied, setCopied] = useState(false);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${message}\n${link}`)}`;

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-olive/30 bg-olive/5 p-4">
      <p className="text-sm font-medium">Link de uso único. Envie só para a pessoa:</p>
      <input readOnly value={link} className="field-input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="btn btn-secondary">
          {copied ? "Copiado" : "Copiar link"}
        </button>
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
          Enviar pelo WhatsApp
        </a>
      </div>
    </div>
  );
}
