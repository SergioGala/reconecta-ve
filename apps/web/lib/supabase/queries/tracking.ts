// Queries y realtime de tracking de vehículos.
// Implementa la DOBLE CAPA: socket (en vivo) + REST (respaldo/relleno).

import { createClient } from "../client";
import {
  trackingStatus,
  prepareOfflineQueue,
  type VehiclePing,
  type TrackingStatus,
} from "@repo/logistics";

// ── Mapeo DB -> App ─────────────────────────────────────────
function rowToPing(row: any): VehiclePing {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    lat: row.lat,
    lng: row.lng,
    recordedAt: row.recorded_at,
    syncedAt: row.synced_at,
    isLastKnown: row.is_last_known,
  };
}

function pingToRow(p: Omit<VehiclePing, "id">) {
  return {
    vehicle_id: p.vehicleId,
    lat: p.lat,
    lng: p.lng,
    recorded_at: p.recordedAt,
    synced_at: p.syncedAt,
    is_last_known: p.isLastKnown,
  };
}

// ════════════════════════════════════════════════════════════
// CAPA 1 — SOCKET (Supabase Realtime): movimiento en vivo
// ════════════════════════════════════════════════════════════

// Se suscribe a nuevos pings de un vehículo en tiempo real.
// Devuelve una función para desuscribirse.
export function subscribeToVehicle(
  vehicleId: string,
  onPing: (ping: VehiclePing) => void
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel(`vehicle-${vehicleId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "vehicle_ping",
        filter: `vehicle_id=eq.${vehicleId}`,
      },
      (payload) => {
        onPing(rowToPing(payload.new));
      }
    )
    .subscribe();

  // Función de limpieza (desuscribirse)
  return () => {
    supabase.removeChannel(channel);
  };
}

// Se suscribe a TODOS los vehículos en ruta (para el mapa del coordinador).
export function subscribeToAllVehicles(
  onPing: (ping: VehiclePing) => void
): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel("all-vehicles")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "vehicle_ping" },
      (payload) => onPing(rowToPing(payload.new))
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ════════════════════════════════════════════════════════════
// CAPA 2 — REST (respaldo): relleno tras reconexión
// ════════════════════════════════════════════════════════════

// Trae los pings de un vehículo desde una fecha (para rellenar lo perdido
// mientras el socket estuvo caído).
export async function getPingsSince(
  vehicleId: string,
  sinceISO: string
): Promise<VehiclePing[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vehicle_ping")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .gte("recorded_at", sinceISO)
    .order("recorded_at", { ascending: true });

  if (error) throw new Error(`Error trayendo pings: ${error.message}`);
  return (data ?? []).map(rowToPing);
}

// Trae el último ping conocido de un vehículo (para mostrar última posición).
export async function getLastPing(vehicleId: string): Promise<VehiclePing | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vehicle_ping")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Error trayendo último ping: ${error.message}`);
  return data ? rowToPing(data) : null;
}

// Estado de tracking listo para la UI (en vivo vs última posición).
export async function getVehicleTrackingStatus(
  vehicleId: string
): Promise<TrackingStatus | null> {
  const last = await getLastPing(vehicleId);
  return trackingStatus(last);
}

// ════════════════════════════════════════════════════════════
// EMISIÓN (lado del chofer): enviar pings
// ════════════════════════════════════════════════════════════

// Envía un ping individual (cuando hay señal).
export async function sendPing(
  vehicleId: string,
  lat: number,
  lng: number
): Promise<void> {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("vehicle_ping").insert(
    pingToRow({
      vehicleId,
      lat,
      lng,
      recordedAt: now,
      syncedAt: now,
      isLastKnown: false,
    })
  );
  if (error) throw new Error(`Error enviando ping: ${error.message}`);
}

// Sube en lote los pings acumulados offline (al reconectar).
// Usa prepareOfflineQueue de @repo/logistics para marcar el último conocido.
export async function flushOfflinePings(
  pings: VehiclePing[]
): Promise<number> {
  if (pings.length === 0) return 0;
  const supabase = createClient();
  const prepared = prepareOfflineQueue(pings);
  const rows = prepared.map((p: VehiclePing) => pingToRow(p));

  const { error } = await supabase.from("vehicle_ping").insert(rows);
  if (error) throw new Error(`Error subiendo pings offline: ${error.message}`);
  return prepared.length;
}