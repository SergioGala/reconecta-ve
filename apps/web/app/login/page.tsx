"use client";

import { useState } from "react";
import { login } from "../auth/actions";
import Link from "next/link";

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
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Reconecta VE</h1>
        <p style={styles.subtitle}>Inicia sesión para coordinar</p>

        <form action={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input type="email" name="email" required autoComplete="email" style={styles.input} />
          </label>

          <label style={styles.label}>
            Contraseña
            <input type="password" name="password" required autoComplete="current-password" style={styles.input} />
          </label>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Entrando..." : "Iniciar sesión"}
          </button>
        </form>

        <p style={styles.footer}>
          ¿No tienes cuenta? <Link href="/registro" style={styles.link}>Regístrate</Link>
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
  button: { padding: "13px", borderRadius: 8, border: "none", background: "#007aff", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 8 },
  error: { fontSize: 13, color: "#ff3b30", background: "rgba(255,59,48,0.1)", padding: "10px", borderRadius: 8, margin: 0 },
  footer: { fontSize: 13, color: "#777", textAlign: "center", marginTop: 20 },
  link: { color: "#007aff", textDecoration: "none" },
};