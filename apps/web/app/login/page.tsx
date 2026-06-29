"use client";

import { useState } from "react";
import { login } from "../auth/actions";
import Link from "next/link";
import { Button } from "@/components/ui/Button/Button";
import styles from "./login.module.css";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await login(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Reconecta VE</h1>
        <p className={styles.subtitle}>Inicia sesión para coordinar</p>

        <form action={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input className={styles.input} type="email" name="email" required autoComplete="email" />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Contraseña</span>
            <input className={styles.input} type="password" name="password" required autoComplete="current-password" />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? "Entrando..." : "Iniciar sesión"}
          </Button>
        </form>

        <p className={styles.footer}>
          ¿No tienes cuenta? <Link href="/registro" className={styles.link}>Regístrate</Link>
        </p>
      </div>
    </div>
  );
}