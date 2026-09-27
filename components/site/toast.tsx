"use client";

import { useEffect, useRef, useState } from "react";
import { TOAST_EVENT } from "@/lib/site-events";

// Short confirmation at the bottom of the screen ("Fatia Karen entrou no pedido").
export function Toast() {
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onToast = (event: Event) => {
      setText((event as CustomEvent<string>).detail);
      setVisible(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setVisible(false), 2300);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className={`ck-toast${visible ? " ck-on" : ""}`} role="status">
      {text}
    </div>
  );
}
