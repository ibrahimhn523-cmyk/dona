"use client";
import { getSupabase } from "./supabaseClient";

async function uid() {
  const sb = getSupabase();
  const { data } = await sb.auth.getUser();
  return data && data.user ? data.user.id : null;
}

// ---------- المهام ----------
export async function addTask({ title, description, priority = "med", project_id = null, due_date = null }) {
  const sb = getSupabase();
  const user_id = await uid();
  const { data, error } = await sb.from("tasks").insert({ user_id, title, description, priority, project_id, due_date }).select().single();
  if (error) throw error;
  return data;
}
export async function listTasks({ status = null } = {}) {
  const sb = getSupabase();
  let q = sb.from("tasks").select("*, projects(title, goal_id, goals(title))").order("due_date", { ascending: true, nullsFirst: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// ---------- المواعيد ----------
export async function addEvent({ title, description = null, location = null, starts_at, ends_at = null }) {
  const sb = getSupabase();
  const user_id = await uid();
  const { data, error } = await sb.from("events").insert({ user_id, title, description, location, starts_at, ends_at }).select().single();
  if (error) throw error;
  return data;
}
export async function listEvents() {
  const sb = getSupabase();
  const { data, error } = await sb.from("events").select("*").order("starts_at", { ascending: true });
  if (error) throw error;
  return data;
}

// ---------- التذكيرات ----------
export async function addReminder({ title, remind_at, task_id = null }) {
  const sb = getSupabase();
  const user_id = await uid();
  const { data, error } = await sb.from("reminders").insert({ user_id, title, remind_at, task_id }).select().single();
  if (error) throw error;
  return data;
}
export async function listReminders() {
  const sb = getSupabase();
  const { data, error } = await sb.from("reminders").select("*").eq("status", "pending").order("remind_at", { ascending: true });
  if (error) throw error;
  return data;
}

// ---------- الأهداف والمشاريع ----------
export async function addGoal({ title, description = null, priority = "med" }) {
  const sb = getSupabase();
  const user_id = await uid();
  const { data, error } = await sb.from("goals").insert({ user_id, title, description, priority }).select().single();
  if (error) throw error;
  return data;
}
export async function addProject({ title, description = null, priority = "med", goal_id = null }) {
  const sb = getSupabase();
  const user_id = await uid();
  const { data, error } = await sb.from("projects").insert({ user_id, title, description, priority, goal_id }).select().single();
  if (error) throw error;
  return data;
}
export async function getHierarchy() {
  const sb = getSupabase();
  const { data: goals } = await sb.from("goals").select("*").order("priority");
  const { data: projects } = await sb.from("projects").select("*").order("priority");
  const { data: tasks } = await sb.from("tasks").select("*").order("priority");
  return { goals: goals || [], projects: projects || [], tasks: tasks || [] };
}

// ---------- حذف وتعديل عام ----------
const TABLES = ["tasks", "events", "reminders", "goals", "projects", "memory_facts"];
export async function deleteItem({ table, id }) {
  if (!TABLES.includes(table)) throw new Error("جدول غير مسموح");
  const sb = getSupabase();
  const { error } = await sb.from(table).delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}
export async function updateItem({ table, id, changes }) {
  if (!TABLES.includes(table)) throw new Error("جدول غير مسموح");
  const sb = getSupabase();
  const { data, error } = await sb.from(table).update(changes).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

// ---------- الذاكرة ----------
export async function addFact({ kind = "other", subject = null, content, metadata = {} }) {
  const sb = getSupabase();
  const user_id = await uid();
  const { data, error } = await sb.from("memory_facts").insert({ user_id, kind, subject, content, metadata }).select().single();
  if (error) throw error;
  return data;
}
export async function searchMemory({ query }) {
  const sb = getSupabase();
  const like = `%${query}%`;
  const [facts, tasks, events] = await Promise.all([
    sb.from("memory_facts").select("*").or(`content.ilike.${like},subject.ilike.${like}`),
    sb.from("tasks").select("*").ilike("title", like),
    sb.from("events").select("*").ilike("title", like),
  ]);
  return { facts: facts.data || [], tasks: tasks.data || [], events: events.data || [] };
}

// ---------- اشتراك حيّ (Realtime) ----------
export function subscribeChanges(onChange) {
  const sb = getSupabase();
  const ch = sb.channel("dona-changes");
  ["tasks", "events", "reminders", "goals", "projects"].forEach((tbl) => {
    ch.on("postgres_changes", { event: "*", schema: "public", table: tbl }, () => { if (onChange) onChange(); });
  });
  ch.subscribe();
  return () => { try { sb.removeChannel(ch); } catch (e) {} };
}

// ---------- التفضيلات ----------
export async function getPreferences() {
  const sb = getSupabase();
  const user_id = await uid();
  const { data } = await sb.from("user_preferences").select("*").eq("user_id", user_id).maybeSingle();
  return data;
}
export async function savePreferences(prefs) {
  const sb = getSupabase();
  const user_id = await uid();
  const { data, error } = await sb.from("user_preferences").upsert({ user_id, ...prefs }).select().single();
  if (error) throw error;
  return data;
}
