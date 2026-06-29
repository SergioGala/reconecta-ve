import { supabase } from "../../lib/supabase";
import type { CollectionCenter } from "@repo/logistics";
import styles from "./centros.module.css";

const TYPE_LABEL: Record<string, string> = {
  alimentos: "Alimentos",
  medicinas: "Medicinas",
  mixto: "Mixto",
  agua: "Agua",
  higiene: "Higiene",
};

const STATUS_LABEL: Record<string, string> = {
  activo: "Activo",
  lleno: "Lleno",
  cerrado: "Cerrado",
};

export default async function CentrosPage() {
  const { data, error } = await supabase
    .from("collection_center")
    .select(
    "id, name, type, address, manager_name, manager_contact_masked, status, verified, lat, lng, updated_at, org_id"
    )
    .order("verified", { ascending: false })
    .order("name", { ascending: true });

  // La DB usa snake_case; los tipos del paquete usan camelCase. Mapeamos.
  const centros: CollectionCenter[] = (data ?? []).map((r : any) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    lat: r.lat,
    lng: r.lng,
    address: r.address,
    managerName: r.manager_name,
    managerContactMasked: r.manager_contact_masked,
    status: r.status,
    verified: r.verified,
    orgId: r.org_id,
    lastUpdatedAt: r.updated_at,
    
  }));

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>Centros de acopio</h1>
        <p className={styles.subtitle}>
          Dónde llevar donaciones de forma segura. {centros.length}{" "}
          {centros.length === 1 ? "centro activo" : "centros listados"}.
        </p>
      </header>

      {error && (
        <p className={styles.error}>
          No se pudieron cargar los centros. Reintenta en un momento.
        </p>
      )}

      {!error && centros.length === 0 && (
        <p className={styles.empty}>Aún no hay centros registrados.</p>
      )}

      <ul className={styles.grid}>
        {centros.map((c) => (
          <li key={c.id} className={styles.card}>
            <div className={styles.cardTop}>
              <span className={styles.type}>{TYPE_LABEL[c.type] ?? c.type}</span>
              {c.verified && <span className={styles.verified}>✓ Verificado</span>}
            </div>

            <h2 className={styles.name}>{c.name}</h2>
            {c.address && <p className={styles.address}>{c.address}</p>}

            <div className={styles.meta}>
              <span
                className={styles.status}
                data-status={c.status}
              >
                {STATUS_LABEL[c.status] ?? c.status}
              </span>
            </div>

            <div className={styles.manager}>
              <span className={styles.managerName}>{c.managerName}</span>
              {c.managerContactMasked && (
                <span className={styles.contact}>{c.managerContactMasked}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}