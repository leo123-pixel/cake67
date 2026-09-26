"use client";

import { useEffect } from "react";

export function PrintOnLoad() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <button type="button" onClick={() => window.print()} className="btn btn-primary print:hidden">
      Imprimir
    </button>
  );
}
