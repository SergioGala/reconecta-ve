import { trackingDB, type QueuedPing } from "./db";
import { flushOfflinePings } from "@/lib/supabase/queries/tracking";
import type { VehiclePing } from "@repo/logistics";

const BATCH_SIZE = 50;          // pings por lote
const BATCH_DELAY_MS = 800;     // pausa entre lotes (no satura)
const DECIMATE_THRESHOLD = 100; // si hay más de esto, diezmar los viejos
const KEEP_RECENT = 30;         // los últimos N siempre densos

const MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48h: pings más viejos se descartan
const HARD_CAP = 2000;                  // tope absoluto de pings en cola

// Agrega un ping a la cola local (Dexie)
export async function enqueuePing(ping: VehiclePing): Promise<void> {
  await trackingDB.pings.put({ ...ping, attempts: 0 });
}

// Cuántos hay en cola
export async function queueCount(): Promise<number> {
  return trackingDB.pings.count();
}



// Diezma: si hay demasiados pings viejos, deja 1 de cada 3 en los antiguos,
// mantiene densos los recientes. Reduce volumen sin perder forma de ruta.
async function decimateIfNeeded(): Promise<void> {
  const total = await trackingDB.pings.count();
  if (total <= DECIMATE_THRESHOLD) return;

  const all = await trackingDB.pings.orderBy("recordedAt").toArray();
  const cutoff = all.length - KEEP_RECENT;
  const toDelete: string[] = [];

  // En la parte vieja, borra 2 de cada 3 (deja 1)
  for (let i = 0; i < cutoff; i++) {
    if (i % 3 !== 0) toDelete.push(all[i].id);
  }
  if (toDelete.length > 0) await trackingDB.pings.bulkDelete(toDelete);
}

// Sube la cola en lotes ordenados (más antiguo primero). Doble capa REST.
// Devuelve cuántos subió. Lo que falla se queda en cola para reintento.
export async function flushQueue(): Promise<number> {
  if (!navigator.onLine) return 0;

  await decimateIfNeeded();

  const pending = await trackingDB.pings.orderBy("recordedAt").toArray();
  if (pending.length === 0) return 0;

  let uploaded = 0;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    try {
      // prepareOfflineQueue (dentro de flushOfflinePings) ordena y marca último
      await flushOfflinePings(batch as VehiclePing[]);
      await trackingDB.pings.bulkDelete(batch.map((p) => p.id));
      uploaded += batch.length;
      // pausa entre lotes para no saturar
      if (i + BATCH_SIZE < pending.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    } catch {
      // marca intento fallido; se queda en cola para el próximo flush
      await trackingDB.pings.bulkPut(
        batch.map((p) => ({ ...p, attempts: p.attempts + 1 }))
      );
      break; // si un lote falla, paramos (probablemente se cayó la señal)
    }
  }
  return uploaded;
}

// Limpieza: descarta pings vencidos y aplica tope de tamaño.
// Se llama al iniciar tracking y periódicamente.
export async function cleanupQueue(): Promise<void> {
  const now = Date.now();

  // 1. Borra pings más viejos que MAX_AGE_MS (ruta vieja ya no sirve)
  const cutoffISO = new Date(now - MAX_AGE_MS).toISOString();
  await trackingDB.pings.where("recordedAt").below(cutoffISO).delete();

  // 2. Tope duro: si aún hay demasiados, borra los más antiguos
  const total = await trackingDB.pings.count();
  if (total > HARD_CAP) {
    const excess = total - HARD_CAP;
    const oldest = await trackingDB.pings
      .orderBy("recordedAt")
      .limit(excess)
      .primaryKeys();
    await trackingDB.pings.bulkDelete(oldest as string[]);
  }
}