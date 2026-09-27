"use client";

import imageCompression from "browser-image-compression";
import Image from "next/image";
import { useState } from "react";
import { PRODUCT_BUCKET, productImageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/browser";

type Props = {
  name: string;
  folder: string;
  defaultPath: string | null;
  error?: string;
};

// Single image stored in the bucket; the form submits only its path.
export function ImageField({ name, folder, defaultPath, error }: Props) {
  const [path, setPath] = useState(defaultPath);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      if (!file.type.startsWith("image/")) throw new Error("not an image");
      const blob = await imageCompression(file, {
        fileType: "image/webp",
        maxWidthOrHeight: 1600,
        initialQuality: 0.82,
        useWebWorker: true,
      });
      const next = `${folder}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await createClient()
        .storage.from(PRODUCT_BUCKET)
        .upload(next, blob, { contentType: "image/webp" });
      if (uploadError) throw uploadError;
      setPath(next);
    } catch {
      setMessage("Não foi possível enviar esta imagem. Verifique o arquivo e a conexão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={path ?? ""} />
      {path && (
        <Image
          src={productImageUrl(path)}
          alt=""
          width={240}
          height={160}
          className="h-40 w-auto rounded-xl bg-olive object-contain"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <label className={`btn btn-secondary ${busy ? "pointer-events-none opacity-50" : ""}`}>
          {busy ? "Enviando…" : path ? "Trocar imagem" : "Enviar imagem"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
        </label>
        {path && (
          <button type="button" onClick={() => setPath(null)} className="btn btn-secondary">
            Sem imagem própria
          </button>
        )}
      </div>
      {(message || error) && <p className="text-sm text-raspberry">{message ?? error}</p>}
    </div>
  );
}
