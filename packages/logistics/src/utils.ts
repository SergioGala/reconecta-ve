// Utilidades: generación de delivery_code y helpers de centros/geo.

import type { CollectionCenter, SupplyCategory } from './types.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0, I/1 (ambiguos)

// Genera un código corto de entrega legible (ej: "K7P2-9XM4").
export function generateDeliveryCode(rng: () => number = Math.random): string {
  const pick = () => CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  const block = () => pick() + pick() + pick() + pick();
  return `${block()}-${block()}`;
}

// Valida el formato de un delivery_code.
export function isValidDeliveryCode(code: string): boolean {
  const normalized = code.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(normalized);
}

// ¿Este centro puede recibir esta categoría?
export function centerAcceptsCategory(
  center: CollectionCenter,
  category: SupplyCategory
): boolean {
  if (center.status === 'cerrado') return false;
  if (center.type === 'mixto') return true;
  return center.type === category;
}

// Distancia aproximada entre dos puntos (Haversine, en km).
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Enmascara un teléfono para vista pública (deja últimos 4 dígitos).
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return '****' + digits.slice(-4);
}