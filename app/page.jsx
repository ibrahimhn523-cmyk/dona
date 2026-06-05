"use client";
import { useEffect, useRef, useState } from "react";
import { getSupabase } from "../lib/supabaseClient";
import Auth from "../components/Auth";
import { runAgent } from "../lib/agentLoop";
import { getRecognition, speak, stopSpeaking } from "../lib/voice";
import { getHierarchy, getPreferences } from "../lib/db";

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
  const [persona, setPersona] = useState("");
  const [recording, setRecording] = useState(false);
  const recogRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authed) {
      getPreferences().then((p) => { if (p?.behavior_rules?.text) setPersona(p.behavior_rules.text); }).catch(() => {});
      refreshTree();
    }
  }, [authed]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [view, activity]);

  async function refreshTree() {
    try { setTree(await getHierarchy()); } catch (e) { /* قاعدة غير مهيأة بعد */ }
  }

  async function send(textArg) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setView((v) => [...v, { role: "user", text }]);
    const nextConvo = [...convo, { role: "user", content: text }];
    setBusy(true); setActivity("");

    const updated = await runAgent({
      messages: nextConvo,
      persona,
      onAssistantText: (t) => { setView((v) => [...v, { role: "assistant", text: t }]); speak(t); },
      onToolActivity: (name) => setActivity(name),
      onAskUser: (q) => { setView((v) => [...v, { role: "assistant", text: q }]); speak(q); },
    });

    setConvo(updated);
    setActivity("");
    setBusy(false);
    refreshTree();
  }

  function toggleMic() {
    if (recording) { recogRef.current?.stop(); return; }
    const r = getRecognition();
    if (!r) { alert("المتصفح لا يدعم الإدخال الصوتي. استخدم Chrome."); return; }
    recogRef.current = r;
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput(t);
    };
    r.onend = () => setRecording(false);
    r.onerror = () => setRecording(false);
    stopSpeaking();
    r.start();
    setRecording(true);
  }

  async function signOut() {
    await getSupabase().auth.signOut({ scope: "global" });
    setConvo([]); setView([]);
  }

  if (!ready) return <div className="min-h-screen grid place-items-center text-[var(--muted)]">...</div>;
  if (!authed) return <Auth onAuthed={() => setAuthed(true)} />;

  return (
    <div className="max-w-xl mx-auto min-h-screen flex flex-col">
      <header className="bg-[var(--brand)] text-white px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-white text-[var(--brand)] grid place-items-center font-bold">د</span>
          <div>
            <div className="font-bold leading-tight">دونا</div>
            <div className="text-[11px] opacity-80">سكرتيرك الذكي</div>
          </div>
        </div>
        <button onClick={signOut} className="text-xs bg-white/15 rounded-lg px-2 py-1">خروج من كل الأجهزة</button>
      </header>

      <nav className="flex bg-white border-b border-[var(--line)] sticky top-[56px] z-10">
        {[["chat", "المحادثة"], ["tree", "الأهداف"], ["settings", "الشخصية"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2.5 text-sm ${tab === k ? "text-[var(--brand)] border-b-2 border-[var(--brand)] font-bold" : "text-[var(--muted)]"}`}>
            {l}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto scrollbar-thin p-4" ref={scrollRef}>
        {tab === "chat" && (
          <div className="space-y-3">
            {view.length === 0 && (
              <div className="text-center text-[var(--muted)] text-sm py-10">
                قل لدونا: «ذكّرني بالاجتماع بكرا الساعة ٣» أو «وش جدولي بكرا؟»
              </div>
            )}
            {view.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-[var(--brand)] text-white" : "bg-white border border-[var(--line)]"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {activity && <div className="text-xs text-[var(--muted)] text-center">دونا تنفّذ: {activity}…</div>}
          </div>
        )}

        {tab === "tree" && <Tree tree={tree} onRefresh={refreshTree} />}

        {tab === "settings" && (
          <Settings persona={persona} setPersona={setPersona} />
        )}
      </main>

      {tab === "chat" && (
        <div className="bg-white border-t border-[var(--line)] p-3 flex gap-2 items-end sticky bottom-0">
          <button onClick={toggleMic}
            className={`w-11 h-11 rounded-full grid place-items-center shrink-0 ${recording ? "bg-red-600 text-white" : "bg-slate-100 text-[var(--brand)]"}`}>
            🎤
          </button>
          <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="اكتب أو تحدّث..."
            className="flex-1 border border-[var(--line)] rounded-2xl px-3.5 py-2.5 text-sm resize-none max-h-24" />
          <button onClick={() => send()} disabled={busy}
            className="w-11 h-11 rounded-full bg-[var(--brand)] text-white grid place-items-center shrink-0 disabled:opacity-50">➤</button>
        </div>
      )}
    </div>
  );
}

function Tree({ tree, onRefresh }) {
  const { goals, projects, tasks } = tree;
  if (!goals.length && !projects.length && !tasks.length) {
    return <div className="text-center text-[var(--muted)] text-sm py-10">
      لا أهداف بعد. قل لدونا: «أضف هدف: ...» ثم «أضف مشروع تحته».
      <button onClick={onRefresh} className="block mx-auto mt-3 text-xs text-[var(--brand)]">تحديث</button>
    </div>;
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
      <button onClick={onRefresh} className="block mx-auto text-xs text-[var(--brand)]">تحديث</button>
    </div>
  );
}

function Settings({ persona, setPersona }) {
  const [val, setVal] = useState(persona);
  const [saved, setSaved] = useState(false);
  async function save() {
    setPersona(val);
    try {
      const { savePreferences } = await import("../lib/db");
      await savePreferences({ behavior_rules: { text: val } });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { /* */ }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">اكتب شخصية دونا وقواعد سلوكها. مثال: «تكلم باللهجة السعودية باختصار. لا تذكّرني يوم الجمعة قبل الظهر».</p>
      <textarea rows={8} value={val} onChange={(e) => setVal(e.target.value)}
        className="w-full border border-[var(--line)] rounded-xl p-3 text-sm" />
      <button onClick={save} className="bg-[var(--brand)] text-white rounded-xl px-4 py-2 text-sm">حفظ</button>
      {saved && <span className="text-xs text-green-600 mr-2">تم الحفظ ✓</span>}
    </div>
  );
}
