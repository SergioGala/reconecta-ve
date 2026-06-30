"use client";

import { useState } from "react";
import { aprobarCentro } from "./actions";
import { Button } from "@/components/ui/Button/Button";
import type { CollectionCenter } from "@repo/logistics";
import styles from "./aprobar.module.css";

export function AprobarLista({ pendientes }: { pendientes: CollectionCenter[] }) {
  const [lista, setLista] = useState(pendientes);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleAprobar(id: string) {
    setLoadingId(id);
    const res = await aprobarCentro(id);
    setLoadingId(null);
    if (res.ok) setLista((l) => l.filter((c) => c.id !== id));
  }

  return (
    <main className={styles.wrap}>
      <h1 className={styles.title}>Centros pendientes de verificar</h1>
      <p className={styles.sub}>{lista.length} pendiente(s)</p>

      {lista.length === 0 && <p className={styles.empty}>No hay centros pendientes. 🎉</p>}

      <ul className={styles.grid}>
        {lista.map((c) => (
          <li key={c.id} className={styles.card}>
            <h2 className={styles.name}>{c.name}</h2>
            {c.address && <p className={styles.address}>{c.address}</p>}
            <p className={styles.meta}>Responsable: {c.managerName}</p>
            {c.managerContactMasked && <p className={styles.meta}>Contacto: {c.managerContactMasked}</p>}
            <Button variant="success" disabled={loadingId === c.id} onClick={() => handleAprobar(c.id)}>
              {loadingId === c.id ? "Aprobando..." : "Aprobar"}
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}