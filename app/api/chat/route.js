import Anthropic from "@anthropic-ai/sdk";

// الخادم الوسيط الآمن: يحمل مفتاح Claude API سرّاً (متغير بيئة) ولا يكشفه للمتصفح.
// يستقبل رسائل المحادثة + تعريفات الأدوات، ويعيد رد Claude (قد يتضمن طلب أداة).
// تنفيذ الأدوات نفسه يتم في المتصفح (لاستخدام جلسة Supabase وRLS) ثم تُعاد النتائج هنا.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `أنت "دونا"، سكرتير شخصي ذكي تتحدث العربية بطلاقة وتفهم اللهجة السعودية بعمق.
مبادئك:
- استخدم الأدوات المتاحة لتنفيذ طلبات المستخدم (تذكيرات، مواعيد، مهام، أهداف، مشاريع، بحث).
- قبل حساب أي وقت نسبي (بكرا، بعد العصر، الخميس الجاي) استدعِ get_current_context أولاً.
- إذا كان الطلب غامضاً (وقت غير واضح، تفصيل ناقص) استخدم ask_user بدل التخمين.
- البُعد الهرمي مهم: المهمة تخدم مشروعاً، والمشروع يخدم هدفاً. حين تُسأل عن الأولويات أو "لماذا هذه المهمة"، استخدم get_hierarchy واشرح السلسلة الصاعدة.
- ردودك مختصرة ومحترمة بالعربية. لا تستخدم رموزاً تعبيرية إلا إن طلب المستخدم.
- بعد تنفيذ أداة، أكّد النتيجة للمستخدم بجملة واضحة.`;

export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY غير مضبوط على الخادم. أضفه في إعدادات Vercel." },
      { status: 500 }
    );
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "طلب غير صالح" }, { status: 400 }); }
  const { messages, tools, persona } = body || {};
  if (!Array.isArray(messages)) return Response.json({ error: "messages مفقودة" }, { status: 400 });

  const anthropic = new Anthropic({ apiKey: key });
  const system = persona ? `${SYSTEM}\n\nتعليمات إضافية من المستخدم:\n${persona}` : SYSTEM;

  try {
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system,
      tools: tools || [],
      messages,
    });
    return Response.json({
      stop_reason: resp.stop_reason,
      content: resp.content,
    });
  } catch (e) {
    return Response.json({ error: e?.message || "خطأ في الاتصال بـ Claude" }, { status: 502 });
  }
}
