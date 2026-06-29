"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card/Card";
import { Input } from "@/components/ui/Input/Input";
import { Button } from "@/components/ui/Button/Button";
import { registerCenter } from "../actions";
import styles from "./nuevo.module.css";

export function NuevoCentroForm() {
  const [state, formAction, pending] = useActionState(registerCenter, null);
  const router = useRouter();

  return (
    <main className={styles.wrap}>
      <h1 className={styles.title}>Registrar centro de acopio</h1>
      <p className={styles.sub}>
        Estos datos serán públicos para orientar las donaciones. El teléfono se
        guarda enmascarado por privacidad.
      </p>

      <Card>
        <form action={formAction} className={styles.form}>
          <Input
            name="name"
            label="Nombre del centro *"
            placeholder="Ej.: Acopio Plaza Bolívar"
            required
          />

          <div className={styles.row}>
            <label className={styles.selectField}>
              <span>Tipo</span>
              <select name="type" defaultValue="mixto">
                <option value="alimentos">Alimentos</option>
                <option value="medicinas">Medicinas</option>
                <option value="mixto">Mixto</option>
                <option value="agua">Agua</option>
                <option value="higiene">Higiene</option>
              </select>
            </label>

            <label className={styles.selectField}>
              <span>Estado</span>
              <select name="status" defaultValue="activo">
                <option value="activo">Activo</option>
                <option value="lleno">Lleno</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </label>
          </div>

          <Input
            name="address"
            label="Dirección"
            placeholder="Ej.: Av. Sucre, Caracas"
          />

          <div className={styles.row}>
            <Input
              name="managerName"
              label="Responsable *"
              placeholder="Nombre y apellido"
              required
            />
            <Input
              name="managerContact"
              label="Contacto"
              hint="Se guarda enmascarado"
              type="tel"
              placeholder="0412-1234567"
            />
          </div>

          {state?.error && <p className={styles.error}>{state.error}</p>}

          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/centros")}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Guardando…" : "Registrar centro"}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}