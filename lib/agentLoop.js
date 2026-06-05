"use client";
import { TOOLS } from "./tools";
import { executeTool } from "./executor";

// حلقة الوكيل (Orchestrator) — تعمل في المتصفح:
// 1) ترسل المحادثة للخادم الوسيط (الذي ينادي Claude).
// 2) إن طلب Claude أداة، ننفّذها محلياً (بجلسة Supabase) ونعيد النتيجة.
// 3) نكرر حتى ينتهي Claude (stop_reason !== tool_use) أو يطلب توضيحاً (ask_user).
//
// callbacks:
//   onAssistantText(text)  — نص رد الوكيل (يُعرض)
//   onToolActivity(name)   — لإظهار "ينفّذ: ..." في الواجهة
//   onAskUser(question)    — يوقف الحلقة وينتظر رد المستخدم
//
// يعيد المحادثة المحدّثة (messages) لمواصلتها لاحقاً.

const MAX_STEPS = 8;

export async function runAgent({ messages, persona, onAssistantText, onToolActivity, onAskUser }) {
  let convo = [...messages];

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: convo, tools: TOOLS, persona }),
    });
    const data = await res.json();
    if (data.error) {
      onAssistantText?.("⚠ " + data.error);
      return convo;
    }

    const assistantContent = data.content || [];
    convo.push({ role: "assistant", content: assistantContent });

    // اعرض أي نص في الرد
    const textParts = assistantContent.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    if (textParts.trim()) onAssistantText?.(textParts.trim());

    // إن لم يطلب أداة → انتهت الدورة
    if (data.stop_reason !== "tool_use") return convo;

    // نفّذ كل أدوات هذه الدورة
    const toolUses = assistantContent.filter((b) => b.type === "tool_use");
    const toolResults = [];
    let paused = false;

    for (const tu of toolUses) {
      onToolActivity?.(tu.name);
      let result;
      try {
        result = await executeTool(tu.name, tu.input || {});
      } catch (e) {
        result = { error: e?.message || String(e) };
      }

      // ask_user: أوقف وانتظر رد المستخدم
      if (result && result.__ask_user) {
        onAskUser?.(result.question);
        // نعيد نتيجة مبدئية حتى لا تتعطّل بنية الرسائل، ونوقف الحلقة
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: "بانتظار رد المستخدم على السؤال.",
        });
        paused = true;
        continue;
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(result ?? {}),
      });
    }

    convo.push({ role: "user", content: toolResults });
    if (paused) return convo; // ننتظر رد المستخدم في رسالة لاحقة
  }

  onAssistantText?.("توقفت بعد عدة خطوات دون إكمال الطلب. جرّب صياغة أوضح.");
  return convo;
}
