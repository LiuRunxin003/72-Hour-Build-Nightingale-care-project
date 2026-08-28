import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const patients = sqliteTable("patients", {
  id: text("id").primaryKey(),
  clinicId: text("clinic_id").notNull(),
  fullName: text("full_name").notNull(),
  age: integer("age").notNull(),
  identifier: text("identifier").notNull(),
  heightCm: integer("height_cm"),
  weightKg: integer("weight_kg"),
  bmi: text("bmi"),
  bloodPressure: text("blood_pressure"),
  pulse: integer("pulse"),
  allergies: text("allergies"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const careEntries = sqliteTable("care_entries", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  clinicId: text("clinic_id").notNull(),
  authorId: text("author_id").notNull(),
  authorRole: text("author_role").notNull(),
  entryType: text("entry_type").notNull(),
  content: text("content").notNull(),
  allowedRoles: text("allowed_roles").notNull(),
  patientVisible: integer("patient_visible", { mode: "boolean" }).notNull().default(false),
  ai: integer("ai", { mode: "boolean" }).notNull().default(false),
  aiMode: text("ai_mode"),
  approval: text("approval"),
  approvalBy: text("approval_by"),
  provenance: text("provenance").notNull(),
  extractionMode: text("extraction_mode").notNull(),
  validationTarget: text("validation_target").notNull(),
  riskLevel: text("risk_level").notNull(),
  confidenceScore: text("confidence_score").notNull(),
  confidenceLabel: text("confidence_label").notNull(),
  confidenceMeaning: text("confidence_meaning").notNull(),
  importanceScore: integer("importance_score").notNull(),
  importanceReason: text("importance_reason").notNull(),
  deterministicFloor: text("deterministic_floor").notNull(),
  wrongOutcome: text("wrong_outcome").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const careHighlights = sqliteTable("care_highlights", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  sourceEntryId: text("source_entry_id").notNull().references(() => careEntries.id),
  title: text("title").notNull(),
  reason: text("reason").notNull(),
  label: text("label").notNull(),
  tone: text("tone").notNull(),
  riskLevel: text("risk_level").notNull(),
  confidenceScore: text("confidence_score").notNull(),
  confidenceLabel: text("confidence_label").notNull(),
  importanceScore: integer("importance_score").notNull(),
  deterministicFloor: text("deterministic_floor").notNull(),
  abstained: integer("abstained", { mode: "boolean" }).notNull().default(false),
  abstainReason: text("abstain_reason"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const careConflicts = sqliteTable("care_conflicts", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull().references(() => patients.id),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  severity: text("severity").notNull(),
  visibleTo: text("visible_to").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
