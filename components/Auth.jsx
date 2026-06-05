"use client";
import { useState } from "react";
import { getSupabase } from "../lib/supabaseClient";

// شاشة تسجيل الدخول/الإنشاء عبر Supabase Auth (بريد + كلمة مرور).
// الجلسة مستمرة تلقائياً (persistSession) — لا تنقطع بالوقت.
export default function Auth({ onAuthed }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const sb = getSupabase();
    try {
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthed?.();
      } else {
        const { error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("تم إنشاء الحساب. تحقق من بريدك إن طُلب تأكيد، ثم سجّل الدخول.");
        setMode("signin");
      }
    } catch (err) {
      setMsg("⚠ " + (err?.message || "تعذّر تسجيل الدخول"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)]">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-[var(--line)] p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-9 h-9 rounded-full bg-[var(--brand)] text-white grid place-items-center font-bold text-lg">د</span>
          <h1 className="text-xl font-bold">دونا</h1>
        </div>
        <p className="text-sm text-[var(--muted)] mb-5">سكرتيرك الذكي — سجّل الدخول للمتابعة</p>

        <form onSubmit={submit} className="space-y-3">
          <input type="email" required placeholder="البريد الإلكتروني" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-[var(--line)] rounded-xl px-3 py-2.5 text-sm" />
          <input type="password" required placeholder="كلمة المرور" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-[var(--line)] rounded-xl px-3 py-2.5 text-sm" />
          <button disabled={busy} type="submit"
            className="w-full bg-[var(--brand)] text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-60">
            {busy ? "..." : mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب"}
          </button>
        </form>

        {msg && <p className="text-xs mt-3 text-[var(--muted)]">{msg}</p>}

        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-xs text-[var(--brand)] mt-4 block mx-auto">
          {mode === "signin" ? "ليس لديك حساب؟ أنشئ واحداً" : "لديك حساب؟ سجّل الدخول"}
        </button>
      </div>
    </div>
  );
}
