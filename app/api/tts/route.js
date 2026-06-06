// مسار تحويل النص إلى صوت عبر ElevenLabs (صوت نسائي واقعي).
// يعمل فقط إن وُجد ELEVENLABS_API_KEY في متغيرات البيئة.
// إن لم يوجد، يعيد 204 ليعرف المتصفح أن يستخدم صوته المدمج (fallback).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// صوت عربي نسائي افتراضي من ElevenLabs (يمكن تغييره لاحقاً من المتغير).
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

export async function POST(req) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    // لا مفتاح => أخبر المتصفح أن يستخدم صوته المدمج
    return new Response(null, { status: 204 });
  }
  let text = "";
  try { ({ text } = await req.json()); } catch { return Response.json({ error: "bad request" }, { status: 400 }); }
  if (!text) return Response.json({ error: "no text" }, { status: 400 });

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!r.ok) {
      const msg = await r.text();
      return Response.json({ error: "elevenlabs: " + msg.slice(0, 200) }, { status: 502 });
    }
    const audio = await r.arrayBuffer();
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg" } });
  } catch (e) {
    return Response.json({ error: e?.message || "tts error" }, { status: 502 });
  }
}
