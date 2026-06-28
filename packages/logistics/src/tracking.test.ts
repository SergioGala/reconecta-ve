import { describe, it, expect } from 'vitest';
import {
  trackingStatus, prepareOfflineQueue, detectGaps,
  canViewLiveTracking, buildPublicAggregates,
} from './tracking.js';
import type { VehiclePing, Vehicle, Shipment } from './types.js';
import type { ViewerContext } from './tracking.js';

function makePing(overrides: Partial<VehiclePing> = {}): VehiclePing {
  return {
    id: 'p1', vehicleId: 'veh-1', lat: 10.6, lng: -66.9,
    recordedAt: '2026-06-28T12:00:00Z', syncedAt: '2026-06-28T12:00:01Z',
    isLastKnown: false, ...overrides,
  };
}

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'veh-1', plate: 'AB123CD', deviceId: 'device-chofer-1', type: 'camion',
    driverName: 'Pedro', driverContactMasked: '****1234', status: 'en_ruta',
    orgId: 'org-1', ...overrides,
  };
}

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: 'ship-1', vehicleId: 'veh-1', originCenterId: 'center-A',
    destinationCenterId: 'center-B', destinationLabel: 'La Guaira', status: 'en_ruta',
    departedAt: '2026-06-28T10:00:00Z', deliveredAt: null, createdBy: 'coord-1',
    confirmedBy: null, deliveryCode: 'K7P2-9XM4',
    items: [{ id: 'i1', shipmentId: 'ship-1', category: 'medicinas', categoryOther: null, description: 'Med', quantity: 10, unit: 'cajas' }],
    ...overrides,
  };
}

describe('trackingStatus', () => {
  it('marca "en vivo" si el ping es reciente y sincronizado', () => {
    const now = new Date('2026-06-28T12:00:30Z').getTime();
    const status = trackingStatus(makePing(), now);
    expect(status?.live).toBe(true);
    expect(status?.ageLabel).toBe('en vivo');
  });
  it('marca última posición conocida si el ping es viejo', () => {
    const now = new Date('2026-06-28T12:10:00Z').getTime();
    const status = trackingStatus(makePing(), now);
    expect(status?.live).toBe(false);
    expect(status?.ageLabel).toContain('min');
  });
  it('no está en vivo si el ping no está sincronizado', () => {
    const now = new Date('2026-06-28T12:00:30Z').getTime();
    const status = trackingStatus(makePing({ syncedAt: null }), now);
    expect(status?.live).toBe(false);
  });
  it('devuelve null si no hay ping', () => {
    expect(trackingStatus(null)).toBeNull();
  });
});

describe('prepareOfflineQueue', () => {
  it('marca el ping más reciente como última posición conocida', () => {
    const pings = [
      makePing({ id: 'a', recordedAt: '2026-06-28T12:00:00Z', syncedAt: null }),
      makePing({ id: 'b', recordedAt: '2026-06-28T12:05:00Z', syncedAt: null }),
      makePing({ id: 'c', recordedAt: '2026-06-28T12:02:00Z', syncedAt: null }),
    ];
    const result = prepareOfflineQueue(pings, '2026-06-28T12:10:00Z');
    expect(result.find((p) => p.isLastKnown)?.id).toBe('b');
    expect(result.every((p) => p.syncedAt === '2026-06-28T12:10:00Z')).toBe(true);
  });
  it('devuelve vacío si no hay pings', () => {
    expect(prepareOfflineQueue([])).toEqual([]);
  });
});

describe('detectGaps', () => {
  it('detecta un hueco de señal mayor al umbral', () => {
    const pings = [
      makePing({ id: 'a', recordedAt: '2026-06-28T12:00:00Z' }),
      makePing({ id: 'b', recordedAt: '2026-06-28T12:10:00Z' }),
    ];
    const gaps = detectGaps(pings);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].durationMs).toBe(10 * 60 * 1000);
  });
  it('no detecta gaps si los pings son continuos', () => {
    const pings = [
      makePing({ id: 'a', recordedAt: '2026-06-28T12:00:00Z' }),
      makePing({ id: 'b', recordedAt: '2026-06-28T12:00:30Z' }),
    ];
    expect(detectGaps(pings)).toHaveLength(0);
  });
});

describe('canViewLiveTracking (seguridad por rol)', () => {
  const vehicle = makeVehicle();
  const shipment = makeShipment();

  it('superadmin ve todo', () => {
    expect(canViewLiveTracking({ role: 'publico', userId: 'x', isSuperadmin: true }, vehicle, shipment)).toBe(true);
  });
  it('coordinador ve todo', () => {
    expect(canViewLiveTracking({ role: 'coordinador', userId: 'c1' }, vehicle, shipment)).toBe(true);
  });
  it('chofer ve su propio vehículo', () => {
    expect(canViewLiveTracking({ role: 'chofer', userId: 'device-chofer-1' }, vehicle, shipment)).toBe(true);
  });
  it('chofer NO ve vehículo de otro', () => {
    const otroShipment = makeShipment({ createdBy: 'otro' });
    expect(canViewLiveTracking({ role: 'chofer', userId: 'otro-device' }, vehicle, otroShipment)).toBe(false);
  });
  it('centro ve envíos que salen de o llegan a él', () => {
    expect(canViewLiveTracking({ role: 'centro', userId: 'u1', centerId: 'center-A' }, vehicle, shipment)).toBe(true);
  });
  it('centro NO ve envíos ajenos', () => {
    expect(canViewLiveTracking({ role: 'centro', userId: 'u1', centerId: 'center-Z' }, vehicle, shipment)).toBe(false);
  });
  it('receptor ve solo su envío por delivery_code', () => {
    expect(canViewLiveTracking({ role: 'receptor', userId: 'u1', deliveryCodes: ['K7P2-9XM4'] }, vehicle, shipment)).toBe(true);
  });
  it('público NUNCA ve tracking en vivo', () => {
    expect(canViewLiveTracking({ role: 'publico', userId: 'anon' }, vehicle, shipment)).toBe(false);
  });
});

describe('buildPublicAggregates', () => {
  it('agrega envíos en ruta sin exponer ubicaciones', () => {
    const shipments = [
      makeShipment({ id: 's1', status: 'en_ruta' }),
      makeShipment({ id: 's2', status: 'en_ruta' }),
      makeShipment({ id: 's3', status: 'entregado' }),
    ];
    const aggs = buildPublicAggregates(shipments);
    const laGuaira = aggs.find((a) => a.zone === 'La Guaira' && a.category === 'medicinas');
    expect(laGuaira?.shipmentsInTransit).toBe(2);
    expect(JSON.stringify(aggs)).not.toContain('lat');
  });
});