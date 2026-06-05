"use client";
import * as db from "./db";

// ينفّذ أداة واحدة طلبها الوكيل ويعيد نتيجة نصية/كائنية.
// ask_user و get_current_context يُعالجان هنا محلياً.
export async function executeTool(name, input) {
  switch (name) {
    case "get_current_context": {
      const now = new Date();
      return {
        iso: now.toISOString(),
        readable: now.toLocaleString("ar-SA", { dateStyle: "full", timeStyle: "short" }),
        weekday: now.toLocaleDateString("ar-SA", { weekday: "long" }),
      };
    }
    case "ask_user":
      // علامة خاصة: الواجهة تعرض السؤال وتنتظر رد المستخدم.
      return { __ask_user: true, question: input.question };

    case "add_reminder": return await db.addReminder(input);
    case "add_event": return await db.addEvent(input);
    case "add_task": return await db.addTask(input);
    case "add_goal": return await db.addGoal(input);
    case "add_project": return await db.addProject(input);
    case "list_reminders": return await db.listReminders();
    case "list_events": return await db.listEvents();
    case "list_tasks": return await db.listTasks(input || {});
    case "get_hierarchy": return await db.getHierarchy();
    case "delete_item": return await db.deleteItem(input);
    case "update_item": return await db.updateItem(input);
    case "search_memory": return await db.searchMemory(input);
    case "add_fact": return await db.addFact(input);
    default:
      return { error: `أداة غير معروفة: ${name}` };
  }
}
