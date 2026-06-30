"use server";

import { verifyCenter } from "@/lib/supabase/queries/centers";
import { getCurrentProfile } from "@/lib/supabase/queries/profile";
import { revalidatePath } from "next/cache";

export async function aprobarCentro(id: string) {
  const profile = await getCurrentProfile();
  const canApprove =
    profile?.role === "coordinador" || profile?.role === "ong" || profile?.isSuperadmin;
  if (!canApprove) return { error: "Sin permiso para aprobar" };

  try {
    await verifyCenter(id);
    revalidatePath("/centros/aprobar");
    revalidatePath("/centros");
    return { ok: true };
  } catch (e: any) {
    return { error: e.message ?? "Error al aprobar" };
  }
}