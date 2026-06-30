import Dexie, { type Table } from "dexie";
import type { VehiclePing } from "@repo/logistics";

// Cola local de pings (sobrevive cierres de la app)
export interface QueuedPing extends VehiclePing {
  attempts: number; // intentos de subida fallidos
}

class TrackingDB extends Dexie {
  pings!: Table<QueuedPing, string>;
  constructor() {
    super("reconecta_tracking");
    this.version(1).stores({
      // indexado por recordedAt para ordenar y diezmar eficiente
      pings: "id, recordedAt, vehicleId",
    });
  }
}

export const trackingDB = new TrackingDB();