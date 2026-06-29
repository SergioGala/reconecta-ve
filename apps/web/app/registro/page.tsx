"use client";

import { useState } from "react";
import { register } from "../auth/actions";
import Link from "next/link";
import { Button } from "@/components/ui/Button/Button";
import styles from "./registro.module.css";

export default function RegistroPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await register(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Crear cuenta</h1>
        <p className={styles.subtitle}>Únete a la coordinación de Reconecta VE</p>

        <form action={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>Nombre completo</span>
            <input className={styles.input} type="text" name="fullName" required autoComplete="name" />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input className={styles.input} type="email" name="email" required autoComplete="email" />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Contraseña</span>
            <input className={styles.input} type="password" name="password" required autoComplete="new-password" minLength={8} />
            <span className={styles.hint}>Mínimo 8 caracteres</span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Código de invitación <span className={styles.optional}>(opcional)</span></span>
            <input className={styles.input} type="text" name="inviteCode" autoComplete="off" placeholder="Si tienes uno, asigna tu rol" />
            <span className={styles.hint}>Sin código entras como usuario público</span>
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <Button type="submit" variant="success" fullWidth disabled={loading}>
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </form>

        <p className={styles.footer}>
          ¿Ya tienes cuenta? <Link href="/login" className={styles.link}>Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}