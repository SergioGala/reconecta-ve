"use client";

import { useState } from "react";
import { useDriverTracking } from "@/lib/hooks/useDriverTracking";
import { Button } from "@/components/ui/Button/Button";

export default function ChoferPage() {
  // Por ahora un vehicleId de prueba; luego vendrá del envío asignado
  const [vehicleId, setVehicleId] = useState("");
  const [iniciado, setIniciado] = useState(false);
  const tracking = useDriverTracking(vehicleId);

  function toggle() {
    if (tracking.active) {
      tracking.stop();
      setIniciado(false);
    } else {
      if (!vehicleId.trim()) return;
      tracking.start();
      setIniciado(true);
    }
  }

  return (
    <main style={{ maxWidth: 440, margin: "0 auto", padding: "32px 20px", color: "var(--rv-text)" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Vista del chofer</h1>
      <p style={{ color: "var(--rv-muted)", fontSize: 14, marginBottom: 20 }}>
        Inicia la ruta para emitir tu ubicación en tiempo real.
      </p>

      {!iniciado && (
        <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: "#aaa" }}>ID del vehículo (prueba)</span>
          <input
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            placeholder="pega un vehicle_id de tu tabla vehicle"
            style={{ padding: 12, borderRadius: 8, border: "1px solid var(--rv-border)", background: "var(--rv-surface-2)", color: "var(--rv-text)" }}
          />
        </label>
      )}

      <Button
        variant={tracking.active ? "danger" : "success"}
        fullWidth
        onClick={toggle}
      >
        {tracking.active ? "Finalizar ruta" : "Iniciar ruta"}
      </Button>

      <div style={{ marginTop: 24, fontSize: 14, lineHeight: 1.8 }}>
        <p>Estado: <strong>{tracking.active ? "🟢 Emitiendo" : "⚪ Detenido"}</strong></p>
        <p>Último envío: {tracking.lastSent ? new Date(tracking.lastSent).toLocaleTimeString() : "—"}</p>
        <p>En cola (sin señal): <strong>{tracking.queued}</strong></p>
        {tracking.error && <p style={{ color: "var(--rv-red)" }}>⚠ {tracking.error}</p>}
      </div>
    </main>
  );
}