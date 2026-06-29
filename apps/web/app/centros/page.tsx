import { getCurrentProfile } from "@/lib/supabase/queries/profile";
import { redirect } from "next/navigation";
import { NuevoCentroForm } from "./NuevoCentroForm";

export default async function NuevoCentroPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canManage =
    profile.role === "coordinador" ||
    profile.role === "ong" ||
    profile.isSuperadmin;

  if (!canManage) {
    return (
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px" }}>
        <h1>Sin permiso</h1>
        <p>Tu rol no puede registrar centros de acopio. Habla con un coordinador.</p>
      </main>
    );
  }

  return <NuevoCentroForm />;
}