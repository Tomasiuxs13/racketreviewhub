import { createClient } from "@supabase/supabase-js";
import type { Request } from "express";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables for client");
}

// Create a Supabase client for auth verification from request headers
export function createSupabaseClient(req: Request) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  });

  return client;
}





