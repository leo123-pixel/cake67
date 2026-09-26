"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

const SOUND_KEY = "cake67.orderSound";
const SOUND_GAP_MS = 3000;
const REFRESH_DELAY_MS = 1000;

function readSoundPreference() {
  try {
    return window.localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

function beep(context: AudioContext) {
  const now = context.currentTime;
  [0, 0.18].forEach((offset, i) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = i === 0 ? 880 : 1175;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
    osc.connect(gain).connect(context.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.17);
  });
}

// Listens to order inserts/updates the signed-in staff can see (Realtime
// applies orders RLS), refreshes the page, rings and marks the tab title.
export function OrdersLive() {
  const router = useRouter();
  const [soundOn, setSoundOn] = useState(false);
  const [connected, setConnected] = useState(true);
  const audio = useRef<AudioContext | null>(null);
  const unseen = useRef(0);
  const lastSound = useRef(0);
  const refreshTimer = useRef<number | undefined>(undefined);
  const baseTitle = useRef("");

  useEffect(() => setSoundOn(readSoundPreference()), []);

  useEffect(() => {
    const supabase = createClient();
    let wasDown = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => router.refresh(), REFRESH_DELAY_MS);
    };

    const onNewOrder = () => {
      if (document.hidden) {
        if (unseen.current === 0) baseTitle.current = document.title;
        unseen.current += 1;
        document.title = `(${unseen.current}) Pedidos novos · Cake 67`;
      }
      const now = Date.now();
      if (audio.current && readSoundPreference() && now - lastSound.current > SOUND_GAP_MS) {
        lastSound.current = now;
        void audio.current.resume().then(() => beep(audio.current!));
      }
    };

    (async () => {
      // Subscribe with the user's token, otherwise Realtime evaluates RLS as anon.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);

      channel = supabase
        .channel("orders-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
          scheduleRefresh();
          if (payload.eventType === "INSERT" && (payload.new as { status?: string }).status === "novo") onNewOrder();
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setConnected(true);
            if (wasDown) router.refresh();
            wasDown = false;
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setConnected(false);
            wasDown = true;
          }
        });
    })();

    const onVisible = () => {
      if (!document.hidden && unseen.current > 0) {
        unseen.current = 0;
        document.title = baseTitle.current || document.title;
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [router]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    try {
      window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      // storage blocked: the choice lasts for this page only
    }
    if (next) {
      audio.current ??= new AudioContext();
      beep(audio.current); // user gesture unlocks audio and confirms it works
    }
  }

  // Browsers need a gesture after each load before playing sound.
  useEffect(() => {
    if (!soundOn || audio.current) return;
    const unlock = () => {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [soundOn]);

  return (
    <div className="fixed right-3 bottom-3 z-40 flex flex-col items-end gap-2 print:hidden">
      {!connected && (
        <p role="status" className="rounded-full bg-cocoa px-4 py-2 text-sm text-linen shadow">
          Reconectando…
        </p>
      )}
      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={soundOn}
        className="rounded-full border border-cocoa/20 bg-white px-4 py-2 text-sm shadow hover:border-olive aria-pressed:border-olive aria-pressed:bg-olive aria-pressed:text-linen"
      >
        {soundOn ? "Alerta sonoro ativado" : "Ativar alerta sonoro"}
      </button>
    </div>
  );
}
