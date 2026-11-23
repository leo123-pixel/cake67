"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { pickCake, prefersReducedMotion, scrollToId } from "@/lib/site-events";

type Props = { cakeId: string; name: string; images: string[]; tag: string | null; eager: boolean };

// The cake photo on the showcase card; tapping it opens every photo, large.
export function CakeGallery({ cakeId, name, images, tag, eager }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const many = images.length > 1;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      document.documentElement.style.overflow = "hidden";
    }
    if (!open && el.open) el.close();
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  function show(next: number, smooth = true) {
    const el = track.current;
    const target = Math.max(0, Math.min(images.length - 1, next));
    if (!el) return;
    el.scrollTo({ left: target * el.clientWidth, behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" });
  }

  function onScroll() {
    const el = track.current;
    if (el && el.clientWidth > 0) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function build() {
    setOpen(false);
    pickCake(cakeId);
    scrollToId("encomendas");
  }

  return (
    <>
      <button type="button" className="ck-ph" onClick={() => setOpen(true)} aria-label={`Ampliar fotos do ${name}`}>
        <Image
          src={images[0]}
          alt={name}
          width={420}
          height={630}
          sizes="(max-width: 560px) 72vw, (max-width: 900px) 33vw, 25vw"
          loading={eager ? undefined : "lazy"}
        />
        {tag && <span className="ck-tag">{tag}</span>}
        <span className="ck-zoom" aria-hidden="true">
          {many ? `${images.length} fotos` : "ampliar"}
        </span>
      </button>

      <dialog
        ref={dialog}
        className="ck-lb"
        aria-label={`Fotos do ${name}`}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          // A tap on the dark area around the photo closes it.
          const target = event.target as Element;
          if (target === event.currentTarget || target.classList.contains("ck-lb-box")) setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") show(index + 1);
          if (event.key === "ArrowLeft") show(index - 1);
        }}
      >
        {open && (
          <div className="ck-lb-box">
            <div className="ck-lb-top">
              <h3 className="ck-h">{name}</h3>
              {many && (
                <span className="ck-lb-n">
                  {index + 1} / {images.length}
                </span>
              )}
              <button type="button" className="ck-lb-x" aria-label="Fechar" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <div className="ck-lb-stage">
              <div ref={track} className="ck-lb-track" onScroll={onScroll}>
                {images.map((src, i) => (
                  <div key={src} className="ck-lb-slide">
                    <Image src={src} alt={`${name}, foto ${i + 1}`} fill sizes="(max-width: 700px) 100vw, 600px" priority={i === 0} />
                  </div>
                ))}
              </div>
              {many && (
                <>
                  <button type="button" className="ck-lb-arrow ck-lb-prev" aria-label="Foto anterior" disabled={index === 0} onClick={() => show(index - 1)}>
                    ‹
                  </button>
                  <button
                    type="button"
                    className="ck-lb-arrow ck-lb-next"
                    aria-label="Próxima foto"
                    disabled={index === images.length - 1}
                    onClick={() => show(index + 1)}
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            <div className="ck-lb-bottom">
              {many && (
                <div className="ck-lb-thumbs">
                  {images.map((src, i) => (
                    <button key={src} type="button" aria-label={`Foto ${i + 1}`} aria-current={i === index} onClick={() => show(i)}>
                      <Image src={src} alt="" width={48} height={72} sizes="48px" />
                    </button>
                  ))}
                </div>
              )}
              <button type="button" className="ck-btn ck-btn-olive" onClick={build}>
                Montar este
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
