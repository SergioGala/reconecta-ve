// Máquina de estados de envíos (shipments).
// El cierre del bucle vive aquí: un envío no se da por entregado
// hasta que el receptor confirma con el delivery_code.

import type {
  Shipment,
  ShipmentStatus,
  TransitionResult,
  AuditEntry,
  InventoryMovement,
  SupplyCategory,
} from './types.js';

// Transiciones válidas. Cualquier otra combinación se rechaza.
const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  preparando: ['en_ruta', 'incidencia'],
  en_ruta: ['entregado', 'incidencia'],
  entregado: [], // estado final
  incidencia: ['en_ruta'], // se puede retomar tras resolver
};

export function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// Normaliza un código para comparación (sin espacios ni guiones, mayúsculas).
function normalizeCode(code: string): string {
  return code.replace(/[\s-]+/g, '').toUpperCase();
}

// Despachar: preparando -> en_ruta
export function dispatchShipment(
  shipment: Shipment,
  by: string,
  now: string = new Date().toISOString()
): TransitionResult {
  if (!canTransition(shipment.status, 'en_ruta')) {
    return { ok: false, error: `No se puede despachar desde estado "${shipment.status}"` };
  }
  if (shipment.items.length === 0) {
    return { ok: false, error: 'No se puede despachar un envío sin carga' };
  }
  return {
    ok: true,
    shipment: { ...shipment, status: 'en_ruta', departedAt: now },
  };
}

// Confirmar recepción: en_ruta -> entregado (CIERRE DEL BUCLE)
export function confirmDelivery(
  shipment: Shipment,
  providedCode: string,
  confirmedBy: string,
  now: string = new Date().toISOString()
): TransitionResult {
  if (!canTransition(shipment.status, 'entregado')) {
    return { ok: false, error: `No se puede confirmar entrega desde estado "${shipment.status}"` };
  }
  if (normalizeCode(providedCode) !== normalizeCode(shipment.deliveryCode)) {
    return { ok: false, error: 'Código de entrega incorrecto' };
  }
  if (!confirmedBy.trim()) {
    return { ok: false, error: 'Se requiere identificar quién recibe' };
  }
  return {
    ok: true,
    shipment: {
      ...shipment,
      status: 'entregado',
      deliveredAt: now,
      confirmedBy,
    },
  };
}

// Reportar incidencia: desde preparando o en_ruta -> incidencia
export function reportIncident(
  shipment: Shipment,
  reason: string
): TransitionResult {
  if (!canTransition(shipment.status, 'incidencia')) {
    return { ok: false, error: `No se puede reportar incidencia desde estado "${shipment.status}"` };
  }
  if (!reason.trim()) {
    return { ok: false, error: 'Se requiere un motivo de la incidencia' };
  }
  return {
    ok: true,
    shipment: { ...shipment, status: 'incidencia' },
  };
}

// Retomar tras incidencia: incidencia -> en_ruta
export function resumeShipment(shipment: Shipment): TransitionResult {
  if (!canTransition(shipment.status, 'en_ruta')) {
    return { ok: false, error: `No se puede retomar desde estado "${shipment.status}"` };
  }
  return {
    ok: true,
    shipment: { ...shipment, status: 'en_ruta' },
  };
}

// Genera los movimientos de inventario al confirmar entrega:
// salida del origen + entrada al destino (si el destino es un centro registrado).
export function movementsFromDelivery(
  shipment: Shipment,
  recordedBy: string,
  now: string = new Date().toISOString()
): Omit<InventoryMovement, 'id'>[] {
  const movements: Omit<InventoryMovement, 'id'>[] = [];
  for (const item of shipment.items) {
    if (shipment.originCenterId) {
      movements.push({
        centerId: shipment.originCenterId,
        direction: 'salida',
        category: item.category,
        categoryOther: item.categoryOther,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        relatedShipmentId: shipment.id,
        recordedBy,
        recordedAt: now,
      });
    }
    if (shipment.destinationCenterId) {
      movements.push({
        centerId: shipment.destinationCenterId,
        direction: 'entrada',
        category: item.category,
        categoryOther: item.categoryOther,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        relatedShipmentId: shipment.id,
        recordedBy,
        recordedAt: now,
      });
    }
  }
  return movements;
}

// Construye una entrada de auditoría para una transición.
export function buildAudit(
  who: string,
  before: ShipmentStatus | null,
  after: ShipmentStatus,
  now: string = new Date().toISOString()
): AuditEntry {
  return { who, what: `shipment:${before ?? 'nuevo'}->${after}`, when: now, before, after };
}

// Resumen agregado de categorías (para vistas públicas sin exponer detalle).
export function summarizeCategories(shipment: Shipment): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const item of shipment.items) {
    const key = item.category === 'otros' && item.categoryOther
      ? `otros:${item.categoryOther}`
      : item.category;
    summary[key] = (summary[key] ?? 0) + item.quantity;
  }
  return summary;
}