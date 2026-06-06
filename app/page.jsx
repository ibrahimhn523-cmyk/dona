"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabase } from "../lib/supabaseClient";
import Auth from "../components/Auth";
import { runAgent } from "../lib/agentLoop";
import { createRecognizer, speak, stopSpeaking } from "../lib/voice";
import { getHierarchy, getPreferences, listTasks, updateItem, subscribeChanges } from "../lib/db";

const COLS = [
  { key: "todo", label: "للتنفيذ" },
  { key: "in_progress", label: "جارٍ" },
  { key: "done", label: "منجز" },
];
const PRI = { high: "عالية", med: "متوسطة", low: "منخفضة" };
const PRI_ORDER = { high: 0, med: 1, low: 2 };
function prord(p) { return PRI_ORDER[p] != null ? PRI_ORDER[p] : 3; }

export default function Page() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [convo, setConvo] = useState([]);
  const [view, setView] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState("");
  const [tab, setTab] = useState("chat");
  const [tree, setTree] = useState({ goals: [], projects: [], tasks: [] });
  const [tasks, setTasks] = useState([]);
  const [persona, setPersona] = useState("");
  const [recording, setRecording] = useState(false);
  const recRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => { setAuthed(!!data.session); setReady(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authed) return;
    getPreferences().then((p) => { if (p && p.behavior_rules && p.behavior_rules.text) setPersona(p.behavior_rules.text); }).catch(() => {});
    refreshAll();
    const unsub = subscribeChanges(() => refreshAll());
    const onFocus = () => refreshAll();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { if (unsub) unsub(); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [authed]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [view, activity]);

  async function refreshAll() {
    try { setTree(await getHierarchy()); } catch (e) {}
    try { setTasks(await listTasks()); } catch (e) {}
  }

  async function send(textArg) {
    const text = (textArg != null ? textArg : input).trim();
    if (!text || busy) return;
    setInput("");
    setView((v) => [...v, { role: "user", text }]);
    const nextConvo = [...convo, { role: "user", content: text }];
    setBusy(true); setActivity("");
    const updated = await runAgent({
      messages: nextConvo, persona,
      onAssistantText: (t) => { setView((v) => [...v, { role: "assistant", text: t }]); speak(t); },
      onToolActivity: (name) => setActivity(name),
      onAskUser: (q) => { setView((v) => [...v, { role: "assistant", text: q }]); speak(q); },
    });
    setConvo(updated); setActivity(""); setBusy(false); refreshAll();
  }

  function toggleMic() {
    if (recording) { if (recRef.current) recRef.current.stop(); setRecording(false); return; }
    const rec = createRecognizer({
      onText: (t) => setInput(t),
      onStop: () => setRecording(false),
      onError: (e) => { setRecording(false); if (e === "not-allowed") alert("اسمح بالوصول للميكروفون."); },
    });
    if (!rec) { alert("المتصفح لا يدعم الإدخال الصوتي. استخدم Chrome."); return; }
    recRef.current = rec; stopSpeaking(); rec.start(); setRecording(true);
  }

  async function moveTask(t, dir) {
    const order = ["todo", "in_progress", "done"];
    const i = order.indexOf(t.status);
    const ni = Math.max(0, Math.min(order.length - 1, i + dir));
    if (ni === i) return;
    try { await updateItem({ table: "tasks", id: t.id, changes: { status: order[ni] } }); refreshAll(); } catch (e) {}
  }

  async function signOut() { await getSupabase().auth.signOut({ scope: "global" }); setConvo([]); setView([]); }

  if (!ready) return <div className="min-h-screen grid place-items-center text-[var(--muted)]">...</div>;
  if (!authed) return <Auth onAuthed={() => setAuthed(true)} />;

  const today = todayTasks(tasks);

  return (
    <div className="max-w-xl mx-auto min-h-screen flex flex-col">
      <header className="bg-[var(--brand)] text-white px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-white text-[var(--brand)] grid place-items-center font-bold">د</span>
          <div><div className="font-bold leading-tight">دونا</div><div className="text-[11px] opacity-80">سكرتيرك الذكي</div></div>
        </div>
        <button onClick={signOut} className="text-xs bg-white/15 rounded-lg px-2 py-1">خروج من كل الأجهزة</button>
      </header>

      <nav className="flex bg-white border-b border-[var(--line)] sticky top-[56px] z-10 overflow-x-auto">
        {[["chat", "المحادثة"], ["tasks", "المهام"], ["tree", "الأهداف"], ["settings", "الشخصية"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 min-w-[80px] py-2.5 text-sm ${tab === k ? "text-[var(--brand)] border-b-2 border-[var(--brand)] font-bold" : "text-[var(--muted)]"}`}>{l}</button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto scrollbar-thin p-4" ref={scrollRef}>
        {tab === "chat" && (
          <div className="space-y-3">
            {today.length > 0 && (
              <div className="bg-white border border-[var(--line)] rounded-xl p-3 text-sm">
                <div className="font-bold text-[var(--brand)] mb-1">اليوم</div>
                {today.map((t) => <div key={t.id} className="text-[var(--ink)]">• {t.title}</div>)}
              </div>
            )}
            {view.length === 0 && today.length === 0 && (
              <div className="text-center text-[var(--muted)] text-sm py-10">قل لدونا: «ذكّرني بالاجتماع بكرا الساعة ٣»</div>
            )}
            {view.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-[var(--brand)] text-white" : "bg-white border border-[var(--line)]"}`}>{m.text}</div>
              </div>
            ))}
            {activity && <div className="text-xs text-[var(--muted)] text-center">دونا تنفّذ: {activity}…</div>}
          </div>
        )}

        {tab === "tasks" && <Kanban tasks={tasks} onMove={moveTask} />}
        {tab === "tree" && <Tree tree={tree} onRefresh={refreshAll} />}
        {tab === "settings" && <Settings persona={persona} setPersona={setPersona} />}
      </main>

      {tab === "chat" && (
        <div className="bg-white border-t border-[var(--line)] p-3 flex gap-2 items-end sticky bottom-0">
          <button onClick={toggleMic} className={`w-11 h-11 rounded-full grid place-items-center shrink-0 ${recording ? "bg-red-600 text-white animate-pulse" : "bg-slate-100 text-[var(--brand)]"}`}>🎤</button>
          <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={recording ? "أستمع… تحدّث ثم اضغط المايك للإيقاف" : "اكتب أو تحدّث..."}
            className="flex-1 border border-[var(--line)] rounded-2xl px-3.5 py-2.5 text-sm resize-none max-h-24" />
          <button onClick={() => send()} disabled={busy} className="w-11 h-11 rounded-full bg-[var(--brand)] text-white grid place-items-center shrink-0 disabled:opacity-50">➤</button>
        </div>
      )}
    </div>
  );
}

function todayTasks(tasks) {
  const end = new Date(); end.setHours(23, 59, 59, 999);
  return (tasks || []).filter((t) => t.status !== "done" && t.due_date && new Date(t.due_date) <= end);
}

function Kanban({ tasks, onMove }) {
  if (!tasks || !tasks.length) {
    return <div className="text-center text-[var(--muted)] text-sm py-10">لا مهام بعد. أضِف من تبويب المحادثة: «أضف مهمة ...»</div>;
  }
  const byStatus = (s) => tasks.filter((t) => (t.status || "todo") === s).sort((a, b) => prord(a.priority) - prord(b.priority));
  return (
    <div className="space-y-4">
      {COLS.map((c) => (
        <div key={c.key}>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="font-bold text-sm text-[var(--brand)]">{c.label}</h3>
            <span className="text-xs text-[var(--muted)]">{byStatus(c.key).length}</span>
          </div>
          <div className="space-y-2">
            {byStatus(c.key).map((t) => (
              <div key={t.id} className="bg-white border border-[var(--line)] rounded-xl p-3">
                <div className={`text-sm ${t.status === "done" ? "line-through text-[var(--muted)]" : ""}`}>{t.title}</div>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-[var(--muted)]">
                  {t.priority && <span className="px-2 py-0.5 rounded-full bg-slate-100">{PRI[t.priority]}</span>}
                  {t.projects && t.projects.title && <span>📁 {t.projects.title}</span>}
                  {t.due_date && <span>⏰ {new Date(t.due_date).toLocaleDateString("ar", { month: "short", day: "numeric" })}</span>}
                  <span className="flex-1" />
                  <button onClick={() => onMove(t, -1)} disabled={t.status === "todo"} className="px-1.5 disabled:opacity-30">→</button>
                  <button onClick={() => onMove(t, 1)} disabled={t.status === "done"} className="px-1.5 disabled:opacity-30">←</button>
                </div>
              </div>
            ))}
            {byStatus(c.key).length === 0 && <div className="text-xs text-[var(--muted)] py-2">—</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Tree({ tree, onRefresh }) {
  const goals = tree.goals, projects = tree.projects, tasks = tree.tasks;
  const orphan = (tasks || []).filter((t) => !t.project_id);
  if (!goals.length && !projects.length && !tasks.length) {
    return <div className="text-center text-[var(--muted)] text-sm py-10">لا أهداف بعد. قل: «أضف هدف: ...».<button onClick={onRefresh} className="block mx-auto mt-3 text-xs text-[var(--brand)]">تحديث</button></div>;
  }
  return (
    <div className="space-y-3">
      {goals.map((g) => (
        <div key={g.id} className="bg-white border border-[var(--line)] rounded-xl p-3">
          <div className="font-bold text-[var(--brand)]">🎯 {g.title}</div>
          {projects.filter((p) => p.goal_id === g.id).map((p) => (
            <div key={p.id} className="mt-2 pr-3 border-r-2 border-[var(--line)]">
              <div className="font-medium text-sm">📁 {p.title}</div>
              {tasks.filter((t) => t.project_id === p.id).map((t) => (
                <div key={t.id} className="text-xs text-[var(--muted)] pr-3 mt-1">• {t.title}</div>
              ))}
            </div>
          ))}
        </div>
      ))}
      {orphan.length > 0 && (
        <div className="bg-white border border-[var(--line)] rounded-xl p-3">
          <div className="font-medium text-sm text-[var(--muted)]">مهام غير مرتبطة بهدف</div>
          {orphan.map((t) => <div key={t.id} className="text-xs text-[var(--muted)] pr-3 mt-1">• {t.title}</div>)}
        </div>
      )}
      <button onClick={onRefresh} className="block mx-auto text-xs text-[var(--brand)]">تحديث</button>
    </div>
  );
}

function Settings({ persona, setPersona }) {
  const [val, setVal] = useState(persona);
  const [saved, setSaved] = useState(false);
  async function save() {
    setPersona(val);
    try { const m = await import("../lib/db"); await m.savePreferences({ behavior_rules: { text: val } }); setSaved(true); setTimeout(() => setSaved(false), 2000); } catch (e) {}
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">اكتب شخصية دونا وقواعد سلوكها. مثال: «تكلم باللهجة السعودية باختصار. لا تذكّرني يوم الجمعة قبل الظهر».</p>
      <textarea rows={8} value={val} onChange={(e) => setVal(e.target.value)} className="w-full border border-[var(--line)] rounded-xl p-3 text-sm" />
      <button onClick={save} className="bg-[var(--brand)] text-white rounded-xl px-4 py-2 text-sm">حفظ</button>
      {saved && <span className="text-xs text-green-600 mr-2">تم الحفظ ✓</span>}
    </div>
  );
}
