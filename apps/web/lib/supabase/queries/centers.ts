// Queries de centros de acopio.
// Mapea entre snake_case (DB) y camelCase (app/paquete @repo/logistics).

import { createClient } from "../client";
import type { CollectionCenter, CenterType, CenterStatus } from "@repo/logistics";

// ── Mapeo DB -> App ─────────────────────────────────────────
function rowToCenter(row: any): CollectionCenter {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    managerName: row.manager_name,
    managerContactMasked: row.manager_contact_masked,
    status: row.status,
    verified: row.verified,
    orgId: row.org_id,
    lastUpdatedAt: row.last_updated_at ?? row.updated_at,
  };
}

// ── Listar todos los centros (lectura pública) ──────────────
export async function listCenters(): Promise<CollectionCenter[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("collection_center")
    .select("*")
    .order("name");

  if (error) throw new Error(`Error listando centros: ${error.message}`);
  return (data ?? []).map(rowToCenter);
}

// ── Obtener un centro por id ────────────────────────────────
export async function getCenter(id: string): Promise<CollectionCenter | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("collection_center")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Error obteniendo centro: ${error.message}`);
  return data ? rowToCenter(data) : null;
}

// ── Crear un centro (requiere rol coordinador/ong por RLS) ──
export interface NewCenter {
  name: string;
  type: CenterType;
  lat: number;
  lng: number;
  address?: string;
  managerName: string;
  managerContactMasked?: string;
  orgId?: string | null;
}

export async function createCenter(input: NewCenter): Promise<CollectionCenter> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("collection_center")
    .insert({
      name: input.name,
      type: input.type,
      lat: input.lat,
      lng: input.lng,
      address: input.address ?? null,
      manager_name: input.managerName,
      manager_contact_masked: input.managerContactMasked ?? null,
      org_id: input.orgId ?? null,
      verified: false, // siempre sin verificar; un coordinador aprueba después
      status: "activo",
    })
    .select("*")
    .single();
  if (error) throw new Error(`Error creando centro: ${error.message}`);
  return rowToCenter(data);
}

// ── Actualizar estado de un centro ──────────────────────────
export async function updateCenterStatus(
  id: string,
  status: CenterStatus
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("collection_center")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(`Error actualizando centro: ${error.message}`);
}

// ── Listar centros PENDIENTES de verificar (solo coordinadores) ──
export async function listPendingCenters(): Promise<CollectionCenter[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("collection_center")
    .select("*")
    .eq("verified", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Error listando pendientes: ${error.message}`);
  return (data ?? []).map(rowToCenter);
}

// ── Verificar un centro (solo coordinador/ong por RLS) ──
export async function verifyCenter(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("collection_center")
    .update({ verified: true })
    .eq("id", id);
  if (error) throw new Error(`Error verificando centro: ${error.message}`);
}