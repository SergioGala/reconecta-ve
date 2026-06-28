// Lógica de tracking de vehículos.
// Maneja: detección de gaps de señal, marcado de última posición conocida,
// y filtrado de visibilidad por rol.

import type { VehiclePing, AppRole, Shipment, Vehicle } from './types.js';

// Si el último ping sincronizado es más viejo que esto, el vehículo
// se considera "sin señal" y se muestra su última posición conocida.
const SIGNAL_STALE_MS = 2 * 60 * 1000; // 2 minutos

export interface TrackingStatus {
  vehicleId: string;
  live: boolean; // true = en vivo, false = última posición conocida
  lat: number;
  lng: number;
  lastSeenAt: string;
  ageMs: number;
  ageLabel: string; // "en vivo" | "hace 8 min"
}

function ageLabel(ageMs: number, live: boolean): string {
  if (live) return 'en vivo';
  const min = Math.floor(ageMs / 60000);
  if (min < 1) return 'hace menos de 1 min';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h ${min % 60} min`;
}

// Determina el estado de tracking de un vehículo dado su último ping.
export function trackingStatus(
  lastPing: VehiclePing | null,
  now: number = Date.now()
): TrackingStatus | null {
  if (!lastPing) return null;
  const seen = new Date(lastPing.recordedAt).getTime();
  const ageMs = now - seen;
  const live = ageMs <= SIGNAL_STALE_MS && lastPing.syncedAt !== null;
  return {
    vehicleId: lastPing.vehicleId,
    live,
    lat: lastPing.lat,
    lng: lastPing.lng,
    lastSeenAt: lastPing.recordedAt,
    ageMs,
    ageLabel: ageLabel(ageMs, live),
  };
}

// Al reconectar: toma la cola de pings offline y marca cuál es el último
// conocido. Devuelve los pings listos para sincronizar.
export function prepareOfflineQueue(
  pings: VehiclePing[],
  now: string = new Date().toISOString()
): VehiclePing[] {
  if (pings.length === 0) return [];
  const sorted = [...pings].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );
  return sorted.map((p, i) => ({
    ...p,
    syncedAt: now,
    isLastKnown: i === sorted.length - 1,
  }));
}

// Detecta gaps de señal en un recorrido (huecos > umbral entre pings).
export function detectGaps(
  pings: VehiclePing[],
  gapThresholdMs: number = SIGNAL_STALE_MS
): { fromIndex: number; toIndex: number; durationMs: number }[] {
  const sorted = [...pings].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );
  const gaps: { fromIndex: number; toIndex: number; durationMs: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].recordedAt).getTime();
    const curr = new Date(sorted[i].recordedAt).getTime();
    const diff = curr - prev;
    if (diff > gapThresholdMs) {
      gaps.push({ fromIndex: i - 1, toIndex: i, durationMs: diff });
    }
  }
  return gaps;
}

// ── Visibilidad por rol (seguridad) ─────────────────────────

export interface ViewerContext {
  role: AppRole;
  userId: string;
  isSuperadmin?: boolean;
  orgId?: string | null;
  centerId?: string | null;
  deliveryCodes?: string[];
}

// ¿Puede este viewer ver el tracking en vivo de este vehículo/envío?
export function canViewLiveTracking(
  viewer: ViewerContext,
  vehicle: Vehicle,
  shipment: Shipment | null
): boolean {
  if (viewer.isSuperadmin) return true;
  switch (viewer.role) {
    case 'coordinador':
    case 'ong':
      return true;
    case 'chofer':
      return (
        vehicle.deviceId === viewer.userId ||
        shipment?.createdBy === viewer.userId
      );
    case 'centro':
      if (!shipment || !viewer.centerId) return false;
      return (
        shipment.originCenterId === viewer.centerId ||
        shipment.destinationCenterId === viewer.centerId
      );
    case 'receptor':
      if (!shipment || !viewer.deliveryCodes) return false;
      return viewer.deliveryCodes.includes(shipment.deliveryCode);
    case 'publico':
    default:
      return false;
  }
}

// Para el público: datos agregados sin ubicaciones exactas.
export interface PublicAggregate {
  zone: string;
  category: string;
  shipmentsInTransit: number;
}

export function buildPublicAggregates(shipments: Shipment[]): PublicAggregate[] {
  const inTransit = shipments.filter((s) => s.status === 'en_ruta');
  const map = new Map<string, PublicAggregate>();
  for (const s of inTransit) {
    const zone = s.destinationLabel ?? 'zona no especificada';
    for (const item of s.items) {
      const key = `${zone}:${item.category}`;
      const existing = map.get(key);
      if (existing) {
        existing.shipmentsInTransit += 1;
      } else {
        map.set(key, { zone, category: item.category, shipmentsInTransit: 1 });
      }
    }
  }
  return [...map.values()];
}