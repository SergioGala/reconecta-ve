"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/supabase/queries/profile";
import { maskPhone } from "@repo/logistics";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface CenterResult {
  error?: string;
}

export async function registerCenter(
  _prev: CenterResult | null,
  formData: FormData
): Promise<CenterResult> {
  // 1) Solo gente con permiso de gestión puede registrar centros.
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Debes iniciar sesión para registrar un centro." };


  // Cualquiera con cuenta puede registrar; el centro entra sin verificar
  // y un coordinador lo aprueba después (verified=false más abajo).
  
  // const canManage =
  //   profile.role === "coordinador" ||
  //   profile.role === "ong" ||
  //   profile.isSuperadmin;
  // if (!canManage) {
  //   return { error: "Tu rol no tiene permiso para registrar centros." };
  // }

  // 2) Leer y validar el formulario.
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "mixto");
  const address = String(formData.get("address") ?? "").trim();
  const managerName = String(formData.get("managerName") ?? "").trim();
  const managerContact = String(formData.get("managerContact") ?? "").trim();
  const status = String(formData.get("status") ?? "activo");

  if (!name || !managerName) {
    return { error: "El nombre del centro y el del responsable son obligatorios." };
  }

  // 3) Insertar COMO el usuario logueado (el cliente de sesión lleva su identidad;
  //    el RLS decide si su rol puede). El teléfono se guarda enmascarado.
  const supabase = await createClient();
  const masked = managerContact ? maskPhone(managerContact) : null;

  const { error } = await supabase.from("collection_center").insert({
    name,
    type,
    address: address || null,
    manager_name: managerName,
    manager_contact_masked: masked,
    status,
    verified: false, // los centros nuevos NO nacen verificados
    lat: 10.4806, // Caracas por defecto; el mapa llegará en el Sprint E
    lng: -66.9036,
    org_id: profile.orgId ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/centros");
  redirect("/centros");
}