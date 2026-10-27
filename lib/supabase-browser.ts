"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
/** Anon client: used for Realtime Broadcast/Presence only. Tables are RLS-locked. */
export function supabaseBrowser() {
  client ??= createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ihwgauzuozrmcrhqgfih.supabase.co"), (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_GoYD61QxeE6yoVj5_y8ZXw_ZLfKlI52"), {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}
