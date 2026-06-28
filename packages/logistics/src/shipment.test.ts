import { describe, it, expect } from 'vitest';
import {
  canTransition, dispatchShipment, confirmDelivery,
  reportIncident, resumeShipment, movementsFromDelivery, summarizeCategories,
} from './shipment.js';
import type { Shipment } from './types.js';

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: 'ship-1',
    vehicleId: 'veh-1',
    originCenterId: 'center-origin',
    destinationCenterId: 'center-dest',
    destinationLabel: null,
    status: 'preparando',
    departedAt: null,
    deliveredAt: null,
    createdBy: 'coord-1',
    confirmedBy: null,
    deliveryCode: 'K7P2-9XM4',
    items: [
      { id: 'i1', shipmentId: 'ship-1', category: 'medicinas', categoryOther: null, description: 'Analgésicos', quantity: 50, unit: 'cajas' },
      { id: 'i2', shipmentId: 'ship-1', category: 'agua', categoryOther: null, description: 'Botellones', quantity: 20, unit: 'unidades' },
    ],
    ...overrides,
  };
}

describe('canTransition', () => {
  it('permite preparando -> en_ruta', () => {
    expect(canTransition('preparando', 'en_ruta')).toBe(true);
  });
  it('permite en_ruta -> entregado', () => {
    expect(canTransition('en_ruta', 'entregado')).toBe(true);
  });
  it('rechaza preparando -> entregado (no se salta en_ruta)', () => {
    expect(canTransition('preparando', 'entregado')).toBe(false);
  });
  it('entregado es estado final', () => {
    expect(canTransition('entregado', 'en_ruta')).toBe(false);
  });
});

describe('dispatchShipment', () => {
  it('despacha un envío con carga', () => {
    const r = dispatchShipment(makeShipment(), 'coord-1', '2026-06-28T10:00:00Z');
    expect(r.ok).toBe(true);
    expect(r.shipment?.status).toBe('en_ruta');
    expect(r.shipment?.departedAt).toBe('2026-06-28T10:00:00Z');
  });
  it('rechaza despachar sin carga', () => {
    const r = dispatchShipment(makeShipment({ items: [] }), 'coord-1');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('sin carga');
  });
  it('rechaza despachar un envío ya entregado', () => {
    const r = dispatchShipment(makeShipment({ status: 'entregado' }), 'coord-1');
    expect(r.ok).toBe(false);
  });
});

describe('confirmDelivery (cierre del bucle)', () => {
  it('confirma con el código correcto', () => {
    const enRuta = makeShipment({ status: 'en_ruta' });
    const r = confirmDelivery(enRuta, 'K7P2-9XM4', 'Maria Receptora', '2026-06-28T12:00:00Z');
    expect(r.ok).toBe(true);
    expect(r.shipment?.status).toBe('entregado');
    expect(r.shipment?.confirmedBy).toBe('Maria Receptora');
  });
  it('acepta el código con espacios y minúsculas', () => {
    const r = confirmDelivery(makeShipment({ status: 'en_ruta' }), ' k7p2 9xm4 ', 'Maria');
    expect(r.ok).toBe(true);
  });
  it('rechaza con código incorrecto', () => {
    const r = confirmDelivery(makeShipment({ status: 'en_ruta' }), 'WRON-GCOD', 'Maria');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('incorrecto');
  });
  it('rechaza confirmar sin identificar quién recibe', () => {
    const r = confirmDelivery(makeShipment({ status: 'en_ruta' }), 'K7P2-9XM4', '   ');
    expect(r.ok).toBe(false);
  });
  it('rechaza confirmar un envío que no está en ruta', () => {
    const r = confirmDelivery(makeShipment({ status: 'preparando' }), 'K7P2-9XM4', 'Maria');
    expect(r.ok).toBe(false);
  });
});

describe('reportIncident y resumeShipment', () => {
  it('reporta incidencia con motivo desde en_ruta', () => {
    const r = reportIncident(makeShipment({ status: 'en_ruta' }), 'Camión averiado');
    expect(r.ok).toBe(true);
    expect(r.shipment?.status).toBe('incidencia');
  });
  it('rechaza incidencia sin motivo', () => {
    const r = reportIncident(makeShipment({ status: 'en_ruta' }), '');
    expect(r.ok).toBe(false);
  });
  it('retoma un envío desde incidencia', () => {
    const r = resumeShipment(makeShipment({ status: 'incidencia' }));
    expect(r.ok).toBe(true);
    expect(r.shipment?.status).toBe('en_ruta');
  });
});

describe('movementsFromDelivery', () => {
  it('genera salida del origen y entrada al destino por cada item', () => {
    const movements = movementsFromDelivery(makeShipment({ status: 'entregado' }), 'Maria', '2026-06-28T12:00:00Z');
    expect(movements).toHaveLength(4);
    expect(movements.filter((m) => m.direction === 'salida')).toHaveLength(2);
    expect(movements.filter((m) => m.direction === 'entrada')).toHaveLength(2);
  });
  it('solo genera salidas si no hay centro destino registrado', () => {
    const noDest = makeShipment({ destinationCenterId: null, destinationLabel: 'Refugio La Guaira' });
    const movements = movementsFromDelivery(noDest, 'Maria');
    expect(movements).toHaveLength(2);
    expect(movements.every((m) => m.direction === 'salida')).toBe(true);
  });
});

describe('summarizeCategories', () => {
  it('agrega cantidades por categoría', () => {
    const summary = summarizeCategories(makeShipment());
    expect(summary.medicinas).toBe(50);
    expect(summary.agua).toBe(20);
  });
  it('separa el "otros" por su especificación', () => {
    const ship = makeShipment({ items: [
      { id: 'i1', shipmentId: 'ship-1', category: 'otros', categoryOther: 'pañales', description: 'Pañales bebé', quantity: 30, unit: 'paquetes' },
    ]});
    const summary = summarizeCategories(ship);
    expect(summary['otros:pañales']).toBe(30);
  });
});