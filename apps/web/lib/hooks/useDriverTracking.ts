"use client";

import { useEffect, useRef, useState } from "react";
import { sendPing } from "@/lib/supabase/queries/tracking";
import { enqueuePing, flushQueue, queueCount, cleanupQueue } from "@/lib/tracking/queue";

const PING_INTERVAL_MS = 12_000; // 12s (rango 10-15s)

interface State {
  active: boolean;
  lastSent: string | null;
  queued: number;
  error: string | null;
}

export function useDriverTracking(vehicleId: string) {
  const [state, setState] = useState<State>({
    active: false, lastSent: null, queued: 0, error: null,
  });
  const watchId = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCoords = useRef<{ lat: number; lng: number } | null>(null);

  const refreshQueueCount = async () => {
    const count = await queueCount();
    setState((s) => ({ ...s, queued: count }));
  };

  function start() {
    if (!("geolocation" in navigator)) {
      setState((s) => ({ ...s, error: "Tu dispositivo no tiene GPS" }));
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastCoords.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setState((s) => ({ ...s, error: null }));
      },
      (err) => setState((s) => ({ ...s, error: `GPS: ${err.message}` })),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    cleanupQueue(); // limpia cola vieja (48h) y aplica tope al arrancar

    

    timer.current = setInterval(async () => {
      const coords = lastCoords.current;
      if (!coords) return;
      const now = new Date().toISOString();
      const ping = {
        id: crypto.randomUUID(),
        vehicleId, lat: coords.lat, lng: coords.lng,
        recordedAt: now, syncedAt: null, isLastKnown: false,
      };

      try {
        // Primero intenta vaciar cola pendiente (doble capa)
        await flushQueue();
        // Luego envía el ping actual en vivo
        await sendPing(vehicleId, coords.lat, coords.lng);
        setState((s) => ({ ...s, lastSent: now }));
      } catch {
        // Sin señal: a la cola local Dexie (sobrevive cierre de app)
        await enqueuePing(ping);
      }
      await refreshQueueCount();
    }, PING_INTERVAL_MS);

    setState((s) => ({ ...s, active: true }));
  }

  function stop() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (timer.current) clearInterval(timer.current);
    watchId.current = null;
    timer.current = null;
    setState((s) => ({ ...s, active: false }));
  }

  // Al reconectar la red, intenta vaciar la cola automáticamente
  useEffect(() => {
    function onOnline() { flushQueue().then(refreshQueueCount); }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  useEffect(() => {
    refreshQueueCount();
    return () => stop();
  }, []);

  return { ...state, start, stop };
}