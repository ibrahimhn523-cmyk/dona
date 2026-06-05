"use client";
import { createBrowserClient } from "@supabase/ssr";

// عميل Supabase للمتصفح. الجلسة مستمرة: persistSession + autoRefreshToken
// => المستخدم يبقى مسجّلاً، ولا تنقطع جلسته بالوقت.
let _client = null;

export function getSupabase() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn("Supabase env vars غير مضبوطة — راجع .env.local");
  }
  _client = createBrowserClient(url || "", key || "", {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}
