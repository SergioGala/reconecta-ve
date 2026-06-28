// supabase.ts — compatibilidad. Reexporta el cliente nuevo (@supabase/ssr).
import { createClient } from "./supabase/client";

export const supabase = createClient();