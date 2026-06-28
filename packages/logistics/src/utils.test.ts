import { describe, it, expect } from 'vitest';
import {
  generateDeliveryCode, isValidDeliveryCode,
  centerAcceptsCategory, distanceKm, maskPhone,
} from './utils.js';
import type { CollectionCenter } from './types.js';

function makeCenter(overrides: Partial<CollectionCenter> = {}): CollectionCenter {
  return {
    id: 'c1', name: 'Acopio Central', type: 'mixto', lat: 10.5, lng: -66.9,
    address: 'Caracas', managerName: 'Ana', managerContactMasked: '****5678',
    status: 'activo', verified: true, orgId: null, lastUpdatedAt: '2026-06-28T10:00:00Z',
    ...overrides,
  };
}

describe('generateDeliveryCode', () => {
  it('genera un código con formato XXXX-XXXX', () => {
    expect(generateDeliveryCode(() => 0.5)).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });
  it('no usa caracteres ambiguos (O, 0, I, 1)', () => {
    let i = 0;
    const seq = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
    expect(generateDeliveryCode(() => seq[i++ % seq.length])).not.toMatch(/[O0I1]/);
  });
});

describe('isValidDeliveryCode', () => {
  it('acepta formato correcto', () => {
    expect(isValidDeliveryCode('K7P2-9XM4')).toBe(true);
  });
  it('acepta sin guion y en minúscula', () => {
    expect(isValidDeliveryCode('k7p29xm4')).toBe(true);
  });
  it('rechaza código muy corto', () => {
    expect(isValidDeliveryCode('K7P2')).toBe(false);
  });
});

describe('centerAcceptsCategory', () => {
  it('centro mixto acepta cualquier categoría', () => {
    expect(centerAcceptsCategory(makeCenter({ type: 'mixto' }), 'medicinas')).toBe(true);
  });
  it('centro de medicinas solo acepta medicinas', () => {
    const center = makeCenter({ type: 'medicinas' });
    expect(centerAcceptsCategory(center, 'medicinas')).toBe(true);
    expect(centerAcceptsCategory(center, 'alimentos')).toBe(false);
  });
  it('centro cerrado no acepta nada', () => {
    expect(centerAcceptsCategory(makeCenter({ type: 'mixto', status: 'cerrado' }), 'medicinas')).toBe(false);
  });
});

describe('distanceKm', () => {
  it('calcula distancia Caracas - La Guaira (rango razonable)', () => {
    const d = distanceKm(10.49, -66.88, 10.6, -66.93);
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(30);
  });
  it('distancia de un punto a sí mismo es 0', () => {
    expect(distanceKm(10.5, -66.9, 10.5, -66.9)).toBeCloseTo(0);
  });
});

describe('maskPhone', () => {
  it('deja solo los últimos 4 dígitos', () => {
    expect(maskPhone('+58 412 1234567')).toBe('****4567');
  });
  it('enmascara completo si es muy corto', () => {
    expect(maskPhone('123')).toBe('****');
  });
});