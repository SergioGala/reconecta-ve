"use client";

import { useState } from "react";
import { register } from "../auth/actions";
import Link from "next/link";

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
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Crear cuenta</h1>
        <p style={styles.subtitle}>Únete a la coordinación de Reconecta VE</p>

        <form action={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Nombre completo
            <input type="text" name="fullName" required autoComplete="name" style={styles.input} />
          </label>

          <label style={styles.label}>
            Email
            <input type="email" name="email" required autoComplete="email" style={styles.input} />
          </label>

          <label style={styles.label}>
            Contraseña
            <input type="password" name="password" required autoComplete="new-password" minLength={8} style={styles.input} />
            <span style={styles.hint}>Mínimo 8 caracteres</span>
          </label>

          <label style={styles.label}>
            Código de invitación <span style={styles.optional}>(opcional)</span>
            <input type="text" name="inviteCode" autoComplete="off" style={styles.input} placeholder="Si tienes uno, asigna tu rol" />
            <span style={styles.hint}>Sin código entras como usuario público</span>
          </label>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p style={styles.footer}>
          ¿Ya tienes cuenta? <Link href="/login" style={styles.link}>Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", padding: "1rem" },
  card: { width: "100%", maxWidth: 400, background: "#141414", border: "1px solid #2a2a2a", borderRadius: 16, padding: "2rem" },
  title: { fontSize: 24, fontWeight: 700, color: "#f0f0f0", margin: 0 },
  subtitle: { fontSize: 14, color: "#777", marginTop: 4, marginBottom: 24 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#aaa" },
  input: { padding: "12px", borderRadius: 8, border: "1px solid #2a2a2a", background: "#1e1e1e", color: "#f0f0f0", fontSize: 14 },
  hint: { fontSize: 11, color: "#666" },
  optional: { color: "#666", fontWeight: 400 },
  button: { padding: "13px", borderRadius: 8, border: "none", background: "#34c759", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 8 },
  error: { fontSize: 13, color: "#ff3b30", background: "rgba(255,59,48,0.1)", padding: "10px", borderRadius: 8, margin: 0 },
  footer: { fontSize: 13, color: "#777", textAlign: "center", marginTop: 20 },
  link: { color: "#007aff", textDecoration: "none" },
};