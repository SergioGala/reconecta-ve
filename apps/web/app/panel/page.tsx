import { getCurrentProfile } from "@/lib/supabase/queries/profile";
import { logout } from "../auth/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button/Button";
import styles from "./panel.module.css";

export default async function PanelPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  const roleLabels: Record<string, string> = {
    coordinador: "Coordinador",
    ong: "Organización",
    centro: "Centro de acopio",
    chofer: "Chofer",
    receptor: "Receptor",
    publico: "Usuario",
  };

  const canManage =
    profile.role === "coordinador" ||
    profile.role === "ong" ||
    profile.isSuperadmin;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Reconecta VE</h1>
          <p className={styles.welcome}>Hola, {profile.fullName ?? "usuario"}</p>
        </div>
        <div className={styles.roleTag}>
          {profile.isSuperadmin ? "Superadmin" : roleLabels[profile.role]}
        </div>
      </header>

      <main className={styles.main}>
        <p className={styles.sectionLabel}>Acciones disponibles</p>
        <div className={styles.grid}>
          <Link href="/centros" className={styles.card}>
            <span className={styles.cardTitle}>Centros de acopio</span>
            <span className={styles.cardDesc}>Ver centros y su estado</span>
          </Link>

          {canManage && (
            <>
              <div className={styles.cardDisabled}>
                <span className={styles.cardTitle}>Envíos</span>
                <span className={styles.cardDesc}>Próximamente</span>
              </div>
              <div className={styles.cardDisabled}>
                <span className={styles.cardTitle}>Tracking en vivo</span>
                <span className={styles.cardDesc}>Próximamente</span>
              </div>
            </>
          )}

          {profile.role === "chofer" && (
            <div className={styles.cardDisabled}>
              <span className={styles.cardTitle}>Mi ruta</span>
              <span className={styles.cardDesc}>Próximamente</span>
            </div>
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <form action={logout}>
          <Button type="submit" variant="danger">Cerrar sesión</Button>
        </form>
      </footer>
    </div>
  );
}