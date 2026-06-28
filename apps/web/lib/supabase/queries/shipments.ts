// Queries de envíos (shipments) + items.
// Conecta la máquina de estados de @repo/logistics con las tablas reales.

import { createClient } from "../client";
import {
  generateDeliveryCode,
  type Shipment,
  type ShipmentItem,
  type ShipmentStatus,
  type SupplyCategory,
} from "@repo/logistics";

// ── Mapeo DB -> App ─────────────────────────────────────────
function rowToItem(row: any): ShipmentItem {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    category: row.category,
    categoryOther: row.category_other,
    description: row.description,
    quantity: Number(row.quantity),
    unit: row.unit,
    notes: row.notes,
  };
}

function rowToShipment(row: any): Shipment {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    originCenterId: row.origin_center_id,
    destinationCenterId: row.destination_center_id,
    destinationLabel: row.destination_label,
    status: row.status,
    departedAt: row.departed_at,
    deliveredAt: row.delivered_at,
    createdBy: row.created_by,
    confirmedBy: row.confirmed_by,
    deliveryCode: row.delivery_code,
    items: (row.shipment_item ?? []).map(rowToItem),
  };
}

// ── Listar envíos (RLS filtra según rol) ────────────────────
export async function listShipments(): Promise<Shipment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shipment")
    .select("*, shipment_item(*)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Error listando envíos: ${error.message}`);
  return (data ?? []).map(rowToShipment);
}

// ── Obtener un envío con sus items ──────────────────────────
export async function getShipment(id: string): Promise<Shipment | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shipment")
    .select("*, shipment_item(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Error obteniendo envío: ${error.message}`);
  return data ? rowToShipment(data) : null;
}

// ── Crear envío + items (genera delivery_code) ──────────────
export interface NewShipmentItem {
  category: SupplyCategory;
  categoryOther?: string | null;
  description: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface NewShipment {
  vehicleId?: string | null;
  originCenterId: string;
  destinationCenterId?: string | null;
  destinationLabel?: string | null;
  items: NewShipmentItem[];
}

export async function createShipment(input: NewShipment): Promise<Shipment> {
  const supabase = createClient();
  const deliveryCode = generateDeliveryCode();

  // 1. Crear el envío
  const { data: shipRow, error: shipErr } = await supabase
    .from("shipment")
    .insert({
      vehicle_id: input.vehicleId ?? null,
      origin_center_id: input.originCenterId,
      destination_center_id: input.destinationCenterId ?? null,
      destination_label: input.destinationLabel ?? null,
      delivery_code: deliveryCode,
      status: "preparando",
    })
    .select("*")
    .single();

  if (shipErr) throw new Error(`Error creando envío: ${shipErr.message}`);

  // 2. Crear los items
  const itemsToInsert = input.items.map((it) => ({
    shipment_id: shipRow.id,
    category: it.category,
    category_other: it.categoryOther ?? null,
    description: it.description,
    quantity: it.quantity,
    unit: it.unit,
    notes: it.notes ?? null,
  }));

  const { error: itemsErr } = await supabase
    .from("shipment_item")
    .insert(itemsToInsert);

  if (itemsErr) throw new Error(`Error creando items: ${itemsErr.message}`);

  return (await getShipment(shipRow.id))!;
}

// ── Actualizar estado del envío (despachar/confirmar/etc) ──
export async function updateShipmentStatus(
  id: string,
  status: ShipmentStatus,
  extra: { departedAt?: string; deliveredAt?: string; confirmedBy?: string } = {}
): Promise<void> {
  const supabase = createClient();
  const patch: Record<string, any> = { status };
  if (extra.departedAt) patch.departed_at = extra.departedAt;
  if (extra.deliveredAt) patch.delivered_at = extra.deliveredAt;
  if (extra.confirmedBy) patch.confirmed_by = extra.confirmedBy;

  const { error } = await supabase.from("shipment").update(patch).eq("id", id);
  if (error) throw new Error(`Error actualizando envío: ${error.message}`);
}