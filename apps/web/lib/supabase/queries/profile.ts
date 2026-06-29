// Queries de perfil — leer el usuario actual y su rol.
// Es la pieza que conecta auth con los roles del RLS.

import { createClient } from "../server";
import type { Profile } from "@repo/logistics";

function rowToProfile(row: any): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    isSuperadmin: row.is_superadmin,
    orgId: row.org_id,
    centerId: row.center_id,
    phoneMasked: row.phone_masked,
  };
}

// Devuelve el perfil del usuario logueado (o null si no hay sesión).
// Usa el cliente de SERVIDOR (lee la sesión de las cookies).
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profile")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Error leyendo perfil: ${error.message}`);
  return data ? rowToProfile(data) : null;
}

// Canjea un código de invitación (asigna rol al usuario actual).
// Llama a la función redeem_invitation que creamos en SQL.
export async function redeemInvitation(code: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_invitation", {
    invite_code: code,
  });

  if (error) throw new Error(`Error canjeando invitación: ${error.message}`);
  return data as string;
}