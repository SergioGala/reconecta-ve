"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface AuthResult {
  error?: string;
}

// ── LOGIN ───────────────────────────────────────────────────
export async function login(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Credenciales incorrectas" };
  }

  revalidatePath("/", "layout");
  redirect("/panel");
}

// ── REGISTRO ────────────────────────────────────────────────
export async function register(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const inviteCode = String(formData.get("inviteCode") ?? "").trim();

  if (!email || !password || !fullName) {
    return { error: "Todos los campos son obligatorios" };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    return { error: `Error al registrarse: ${error.message}` };
  }

  // Si trae código de invitación, canjearlo (asigna rol)
  if (inviteCode && data.user) {
    const { error: rpcError } = await supabase.rpc("redeem_invitation", {
      invite_code: inviteCode,
    });
    if (rpcError) {
      // El usuario se creó pero el código falló; avisar sin bloquear
      return { error: `Cuenta creada, pero el código falló: ${rpcError.message}` };
    }
  }

  revalidatePath("/", "layout");
  redirect("/panel");
}

// ── LOGOUT ──────────────────────────────────────────────────
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}