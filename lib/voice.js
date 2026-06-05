"use client";

// الإدخال الصوتي عبر Web Speech API (عربي)، والإخراج عبر SpeechSynthesis.

export function getRecognition() {
  if (typeof window === "undefined") return null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = "ar-SA";
  r.interimResults = true;
  r.continuous = false;
  return r;
}

export function speak(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ar-SA";
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch (e) { /* تجاهل */ }
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
}
