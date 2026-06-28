// Tipos del dominio de logística humanitaria — Reconecta VE
// Alineados a las tablas de Supabase (snake_case en DB -> camelCase aquí).

// ── Uniones (espejo de los ENUM de Postgres) ────────────────
export type SupplyCategory =
  | 'alimentos' | 'medicinas' | 'agua' | 'higiene' | 'ropa' | 'otros';

export type VehicleType = 'camion' | 'camioneta' | 'moto' | 'particular';
export type VehicleStatus = 'disponible' | 'en_ruta' | 'descargando' | 'inactivo';
export type ShipmentStatus = 'preparando' | 'en_ruta' | 'entregado' | 'incidencia';
export type CenterType = 'alimentos' | 'medicinas' | 'mixto' | 'agua' | 'higiene';
export type CenterStatus = 'activo' | 'lleno' | 'cerrado';
export type MovementDirection = 'entrada' | 'salida';
export type RequestPriority = 'critica' | 'alta' | 'media';
export type RequestStatus = 'abierta' | 'parcial' | 'cubierta';
export type AppRole = 'coordinador' | 'ong' | 'chofer' | 'centro' | 'receptor' | 'publico';
export type DonationStatus = 'pendiente' | 'recibida' | 'asignada' | 'ejecutada' | 'reembolsada';

// ── Entidades ───────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  isVerified: boolean;
  orgType: string | null;
  contactMasked: string | null;
}

export interface Profile {
  id: string;
  fullName: string | null;
  role: AppRole;
  isSuperadmin: boolean;
  orgId: string | null;
  centerId: string | null;
  phoneMasked: string | null;
}

export interface Vehicle {
  id: string;
  plate: string | null;
  deviceId: string | null;
  type: VehicleType;
  driverName: string;
  driverContactMasked: string | null;
  status: VehicleStatus;
  orgId: string | null;
}

export interface ShipmentItem {
  id: string;
  shipmentId: string;
  category: SupplyCategory;
  categoryOther: string | null;
  description: string;
  quantity: number;
  unit: string;
  notes?: string | null;
}

export interface Shipment {
  id: string;
  vehicleId: string | null;
  originCenterId: string | null;
  destinationCenterId: string | null;
  destinationLabel: string | null;
  status: ShipmentStatus;
  departedAt: string | null;
  deliveredAt: string | null;
  createdBy: string | null;
  confirmedBy: string | null;
  deliveryCode: string;
  items: ShipmentItem[];
}

export interface VehiclePing {
  id: string;
  vehicleId: string;
  lat: number;
  lng: number;
  recordedAt: string;
  syncedAt: string | null;
  isLastKnown: boolean;
}

export interface CollectionCenter {
  id: string;
  name: string;
  type: CenterType;
  lat: number;
  lng: number;
  address: string | null;
  managerName: string;
  managerContactMasked: string | null;
  status: CenterStatus;
  verified: boolean;
  orgId: string | null;
  lastUpdatedAt: string;
}

export interface InventoryMovement {
  id: string;
  centerId: string;
  direction: MovementDirection;
  category: SupplyCategory;
  categoryOther: string | null;
  description: string;
  quantity: number;
  unit: string;
  relatedShipmentId: string | null;
  recordedBy: string | null;
  recordedAt: string;
}

export interface SupplyRequest {
  id: string;
  centerId: string | null;
  zoneLabel: string;
  category: SupplyCategory;
  categoryOther: string | null;
  description: string;
  quantityNeeded: number;
  unit: string;
  priority: RequestPriority;
  status: RequestStatus;
  createdBy: string | null;
  createdAt: string;
  fulfilledAt: string | null;
}

// ── Resultados de operaciones ───────────────────────────────
export interface TransitionResult {
  ok: boolean;
  shipment?: Shipment;
  error?: string;
}

export interface AuditEntry {
  who: string;
  what: string;
  when: string;
  before: ShipmentStatus | null;
  after: ShipmentStatus;
}