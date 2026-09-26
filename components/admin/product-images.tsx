"use client";

import imageCompression from "browser-image-compression";
import Image from "next/image";
import { useActionState, useState } from "react";
import { addProductImage, removeProductImage, updateImageAlt } from "@/app/admin/(panel)/produtos/actions";
import { reorderItems } from "@/app/admin/(panel)/reorder-action";
import { SortableList } from "@/components/admin/sortable-list";
import { SubmitButton } from "@/components/admin/submit-button";
import { PRODUCT_BUCKET, productImageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/browser";

type ProductImage = { id: string; path: string; alt: string };

const COMPRESSION = {
  fileType: "image/webp",
  maxWidthOrHeight: 1600,
  initialQuality: 0.82,
  useWebWorker: true,
} as const;

async function toWebp(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("not an image");
  return imageCompression(file, COMPRESSION);
}

function AltForm({ image, productName }: { image: ProductImage; productName: string }) {
  const [state, action] = useActionState(updateImageAlt.bind(null, image.id), { ok: false });
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 space-y-1 text-xs text-cocoa-soft">
        Descrição da foto (acessibilidade)
        <input name="alt" defaultValue={image.alt} placeholder={productName} className="field-input" />
      </label>
      <SubmitButton className="btn btn-secondary">Salvar</SubmitButton>
      {state.message && <span className="text-xs text-olive">{state.message}</span>}
    </form>
  );
}

export function ProductImages({
  productId,
  productName,
  images,
}: {
  productId: string;
  productName: string;
  images: ProductImage[];
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList) {
    const supabase = createClient();
    setBusy(true);
    setError(null);

    let index = 0;
    for (const file of Array.from(files)) {
      index += 1;
      setStatus(`Enviando foto ${index} de ${files.length}…`);

      let blob: Blob;
      try {
        blob = await toWebp(file);
      } catch {
        setError(`Não foi possível usar esta imagem: ${file.name}`);
        continue;
      }

      const path = `products/${productId}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from(PRODUCT_BUCKET)
        .upload(path, blob, { contentType: "image/webp" });
      if (uploadError) {
        setError("Falha ao enviar a foto. Verifique a conexão e tente de novo.");
        continue;
      }

      const result = await addProductImage(productId, path);
      if (!result.ok) setError(result.message ?? "Não foi possível salvar a foto.");
    }

    setBusy(false);
    setStatus(null);
  }

  async function remove(image: ProductImage) {
    if (!window.confirm("Remover esta foto?")) return;
    const result = await removeProductImage(image.id);
    if (!result.ok) setError(result.message ?? "Não foi possível remover a foto.");
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-xl text-olive">Fotos</h2>
        <p className="text-sm text-cocoa-soft">A primeira foto é a capa no site. Arraste ou use ↑/↓ para mudar.</p>
      </header>

      <label className={`btn btn-primary ${busy ? "pointer-events-none opacity-50" : ""}`}>
        {busy ? "Enviando…" : "Adicionar fotos"}
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files?.length) void upload(event.target.files);
            event.target.value = "";
          }}
        />
      </label>

      {status && <p role="status" className="text-sm text-cocoa-soft">{status}</p>}
      {error && <p role="alert" className="text-sm text-raspberry">{error}</p>}

      {images.length === 0 ? (
        <p className="text-sm text-cocoa-soft">Nenhuma foto ainda.</p>
      ) : (
        <SortableList
          items={images}
          label={(image) => image.alt || productName}
          onReorder={(ids) => reorderItems("product_images", ids)}
          renderItem={(image) => (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Image
                src={productImageUrl(image.path)}
                alt={image.alt || productName}
                width={96}
                height={96}
                className="size-24 shrink-0 rounded-xl bg-olive object-contain"
              />
              <div className="min-w-0 flex-1">
                <AltForm image={image} productName={productName} />
              </div>
              <button type="button" onClick={() => remove(image)} className="btn btn-danger">
                Remover
              </button>
            </div>
          )}
        />
      )}
    </section>
  );
}
