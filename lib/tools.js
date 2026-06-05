// تعريفات الأدوات التي يراها Claude (tool use schema).
// المنفّذ الفعلي في executor.js يستدعي طبقة البيانات.

export const TOOLS = [
  {
    name: "add_reminder",
    description: "إضافة تذكير بوقت محدد. استخدمه حين يطلب المستخدم تذكيره بشيء.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "نص التذكير" },
        remind_at: { type: "string", description: "وقت التذكير بصيغة ISO 8601 كاملة" },
        task_id: { type: "string", description: "معرّف مهمة مرتبطة (اختياري)" },
      },
      required: ["title", "remind_at"],
    },
  },
  {
    name: "add_event",
    description: "إضافة موعد/حدث له وقت بداية (ونهاية اختيارية).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        starts_at: { type: "string", description: "وقت البداية ISO 8601" },
        ends_at: { type: "string", description: "وقت النهاية ISO 8601 (اختياري)" },
        location: { type: "string", description: "المكان (اختياري)" },
        description: { type: "string" },
      },
      required: ["title", "starts_at"],
    },
  },
  {
    name: "add_task",
    description: "إضافة مهمة. يمكن ربطها بمشروع عبر project_id لفهم سياقها الهرمي.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["high", "med", "low"] },
        project_id: { type: "string", description: "معرّف المشروع الأب (اختياري)" },
        due_date: { type: "string", description: "تاريخ الاستحقاق ISO 8601 (اختياري)" },
      },
      required: ["title"],
    },
  },
  {
    name: "add_goal",
    description: "إضافة هدف استراتيجي شخصي (أعلى الهرم). المشاريع والمهام تخدم الأهداف.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["high", "med", "low"] },
      },
      required: ["title"],
    },
  },
  {
    name: "add_project",
    description: "إضافة مشروع، يُربط بهدف عبر goal_id. المشروع يجمع مهاماً تخدم هدفاً.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["high", "med", "low"] },
        goal_id: { type: "string", description: "معرّف الهدف الأب (اختياري)" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_reminders",
    description: "عرض التذكيرات المعلّقة القادمة.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_events",
    description: "عرض المواعيد القادمة. استخدمه لأسئلة مثل (وش جدولي بكرا؟).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_tasks",
    description: "عرض المهام. يرجع معها سياقها الهرمي (المشروع والهدف) لتفهم لماذا كل مهمة.",
    input_schema: {
      type: "object",
      properties: { status: { type: "string", enum: ["todo", "in_progress", "done"] } },
    },
  },
  {
    name: "get_hierarchy",
    description: "جلب شجرة الأهداف ← المشاريع ← المهام كاملة. استخدمه لترتيب الأولويات أو لشرح لماذا مهمة ما مهمة.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "delete_item",
    description: "حذف عنصر. table أحد: tasks, events, reminders, goals, projects, memory_facts.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string" },
        id: { type: "string" },
      },
      required: ["table", "id"],
    },
  },
  {
    name: "update_item",
    description: "تعديل عنصر. مرّر table و id و changes (الحقول المُعدّلة).",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string" },
        id: { type: "string" },
        changes: { type: "object" },
      },
      required: ["table", "id", "changes"],
    },
  },
  {
    name: "search_memory",
    description: "البحث في الذاكرة الوقائعية والمهام والمواعيد عن كلمة.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "add_fact",
    description: "حفظ واقعة في الذاكرة طويلة المدى. مثل: (د. خالد طبيب قلب).",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["person", "place", "relationship", "preference", "date", "other"] },
        subject: { type: "string" },
        content: { type: "string" },
      },
      required: ["content"],
    },
  },
  {
    name: "get_current_context",
    description: "الوقت والتاريخ الحاليان. استخدمه دائماً قبل حساب أوقات نسبية مثل (بكرا) أو (بعد العصر).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "ask_user",
    description: "اسأل المستخدم للتوضيح عند الغموض بدل التخمين. مثل: (تقصد الصباح أو العصر؟).",
    input_schema: {
      type: "object",
      properties: { question: { type: "string" } },
      required: ["question"],
    },
  },
];
