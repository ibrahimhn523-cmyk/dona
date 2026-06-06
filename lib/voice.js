"use client";

// الإدخال الصوتي عبر Web Speech API (عربي) — التقاط مستمر لا ينقطع عند الصمت.
export function createRecognizer({ onText, onStop, onError } = {}) {
  if (typeof window === "undefined") return null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  let finalText = "";
  let stoppedByUser = false;
  let recog = new SR();
  recog.lang = "ar-SA";
  recog.interimResults = true;
  recog.continuous = true;

  recog.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript + " ";
      else interim += r[0].transcript;
    }
    if (onText) onText((finalText + interim).trim());
  };

  recog.onerror = (ev) => {
    if (ev.error === "no-speech" || ev.error === "aborted") return;
    if (onError) onError(ev.error);
  };

  recog.onend = () => {
    if (!stoppedByUser) {
      try { recog.start(); return; } catch (e) {}
    }
    if (onStop) onStop(finalText.trim());
  };

  return {
    start() { stoppedByUser = false; finalText = ""; try { recog.start(); } catch (e) {} },
    stop() { stoppedByUser = true; try { recog.stop(); } catch (e) {} },
  };
}

let _audio = null;

export async function speak(text) {
  if (typeof window === "undefined" || !text) return;
  stopSpeaking();
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.status === 200) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      _audio = new Audio(url);
      _audio.play().catch(() => browserSpeak(text));
      return;
    }
  } catch (e) {}
  browserSpeak(text);
}

function pickArabicFemaleVoice() {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  const ar = voices.filter((v) => /ar/i.test(v.lang));
  const female = ar.find((v) => /female|woman|Hala|Salma|Zariyah|Amina|Laila|Hoda/i.test(v.name));
  return female || ar[0] || null;
}

function browserSpeak(text) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ar-SA";
  const v = pickArabicFemaleVoice();
  if (v) u.voice = v;
  u.rate = 1;
  u.pitch = 1.15;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  try {
    if (_audio) { _audio.pause(); _audio = null; }
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  } catch (e) {}
}
