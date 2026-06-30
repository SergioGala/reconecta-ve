import { getCurrentProfile } from "@/lib/supabase/queries/profile";
import { listPendingCenters } from "@/lib/supabase/queries/centers";
import { redirect } from "next/navigation";
import { AprobarLista } from "./AprobarLista";

export default async function AprobarPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canApprove =
    profile.role === "coordinador" || profile.role === "ong" || profile.isSuperadmin;
  if (!canApprove) redirect("/centros");

  const pendientes = await listPendingCenters();
  return <AprobarLista pendientes={pendientes} />;
}