export type Role = "patient" | "staff" | "clinician" | "admin";
export type AccessLevel = Role;

export type Entry = {
  id: string;
  date: string;
  time: string;
  author: string;
  role: string;
  type: string;
  content: string;
  allowedRoles: AccessLevel[];
  version: number;
  accent: string;
  patientVisible?: boolean;
  ai?: boolean;
  aiMode?: "raw" | "assisted";
  approval?: "approved" | "needs-review" | "abstained";
  approvalBy?: string;
  provenance: string;
  extractionMode: "extractive" | "generated";
  validationTarget: string;
  riskLevel: "low" | "moderate" | "high" | "critical";
  confidenceScore: number;
  confidenceLabel: "low" | "medium" | "high";
  confidenceMeaning: string;
  importanceScore: number;
  importanceReason: string;
  deterministicFloor: string;
  wrongOutcome: string;
};

export type Highlight = {
  id: string;
  title: string;
  reason: string;
  source: string;
  label: string;
  tone: "red" | "orange" | "blue";
  riskLevel: Entry["riskLevel"];
  confidenceScore: number;
  confidenceLabel: Entry["confidenceLabel"];
  importanceScore: number;
  deterministicFloor: string;
  abstained?: boolean;
  abstainReason?: string;
};

export type Conflict = {
  id: string;
  title: string;
  detail: string;
  severity: "moderate" | "high";
  visibleTo: AccessLevel[];
};

export type PatientProfile = {
  heightCm: string;
  weightKg: string;
  bloodPressure: string;
  bmi: string;
  pulse: string;
  allergies: string;
};

export type WorkspacePayload = {
  role: Role;
  roleLabel: string;
  roleCapability: string;
  patient: {
    id: string;
    name: string;
    age: number;
    identifier: string;
    lastUpdated: string;
  };
  profile: PatientProfile;
  entries: Entry[];
  highlights: Highlight[];
  conflicts: Conflict[];
};

export const roleLabels: Record<Role, string> = {
  patient: "Patient",
  staff: "Staff",
  clinician: "Clinician",
  admin: "Admin",
};

export const roleCapabilities: Record<Role, string> = {
  patient:
    "Can view patient-facing summaries and instructions generated from clinic notes. Cannot view internal comments or raw AI-scribed notes.",
  staff:
    "Can view and add staff notes. Scope remains limited to the current clinic.",
  clinician:
    "Can view and edit clinician sections, and can view staff notes plus all AI-scribed notes within the clinic.",
  admin: "Clinic-scoped oversight across all patient data within the assigned scope.",
};

export function getDefaultPatientProfile(): PatientProfile {
  return {
    heightCm: "172",
    weightKg: "68",
    bloodPressure: "128/82",
    bmi: "23.0",
    pulse: "76",
    allergies: "Penicillin",
  };
}

const allEntries: Entry[] = [
  {
    id: "e6",
    date: "27 Aug 2026",
    time: "09:10",
    author: "Clinic web app summary",
    role: "system",
    type: "Patient-facing AI-assisted summary",
    content:
      "Please book your ECG today. Get urgent help immediately if chest pain happens at rest, breathing gets worse, or you faint.",
    allowedRoles: ["patient", "staff", "clinician", "admin"],
    version: 2,
    accent: "gray",
    patientVisible: true,
    ai: true,
    aiMode: "assisted",
    approval: "approved",
    approvalBy: "Dr Maya Chen",
    provenance: "Derived from clinician section e4 and staff note e3",
    extractionMode: "generated",
    validationTarget: "Approved wording compared against source plan before release",
    riskLevel: "high",
    confidenceScore: 0.92,
    confidenceLabel: "high",
    confidenceMeaning:
      "0.92 means source-backed wording with clinician review before patient release.",
    importanceScore: 90,
    importanceReason: "Patient safety instructions carry a hard release floor.",
    deterministicFloor:
      "If chest pain at rest or fainting is present, highlight cannot rank below HIGH.",
    wrongOutcome:
      "If wrong, the summary is withheld and the patient does not see it until reviewed.",
  },
  {
    id: "e5",
    date: "27 Aug 2026",
    time: "08:42",
    author: "Nightingale AI",
    role: "system",
    type: "Raw AI-scribed patient session",
    content:
      "Patient reports intermittent chest tightness for three days, worse when climbing stairs. Asked whether it could be related to the new medication. No fainting reported.",
    allowedRoles: ["clinician", "admin"],
    version: 1,
    accent: "violet",
    ai: true,
    aiMode: "raw",
    approval: "abstained",
    provenance: "session-ai-3",
    extractionMode: "generated",
    validationTarget: "Needs clinician review against the session transcript",
    riskLevel: "high",
    confidenceScore: 0.67,
    confidenceLabel: "medium",
    confidenceMeaning:
      "0.67 means the model found a plausible issue, but it is not patient-safe without review.",
    importanceScore: 76,
    importanceReason: "Symptom escalation receives a deterministic floor even without feedback.",
    deterministicFloor: "Chest tightness cannot rank below HIGH until resolved.",
    wrongOutcome:
      "If wrong, care team reviews and can dismiss it; it never goes straight to the patient.",
  },
  {
    id: "e4",
    date: "27 Aug 2026",
    time: "08:20",
    author: "Dr Maya Chen",
    role: "clinician",
    type: "Clinician section",
    content:
      "Review symptoms today. Arrange ECG and medication reconciliation. Escalate immediately if pain occurs at rest, breathlessness worsens, or syncope develops.",
    allowedRoles: ["clinician", "admin"],
    version: 3,
    accent: "blue",
    patientVisible: true,
    provenance: "Direct clinician-authored note",
    extractionMode: "extractive",
    validationTarget: "Validated against signed clinician content",
    riskLevel: "high",
    confidenceScore: 0.96,
    confidenceLabel: "high",
    confidenceMeaning:
      "0.96 means this is directly sourced from a signed clinician note.",
    importanceScore: 88,
    importanceReason: "Escalation language and symptom risk force a high floor.",
    deterministicFloor: "Syncope and breathlessness push the floor to HIGH or CRITICAL.",
    wrongOutcome:
      "If wrong, the revision history preserves the source and the team can revert.",
  },
  {
    id: "e3",
    date: "26 Aug 2026",
    time: "16:05",
    author: "Nurse Sofia Lim",
    role: "staff",
    type: "Staff note",
    content:
      "Patient called about chest discomfort. ECG appointment not yet booked. Medication list still shows amoxicillin 500 mg.",
    allowedRoles: ["staff", "clinician", "admin"],
    version: 2,
    accent: "green",
    provenance: "Direct staff-authored note",
    extractionMode: "extractive",
    validationTarget: "Validated against staff note revision history",
    riskLevel: "moderate",
    confidenceScore: 0.89,
    confidenceLabel: "high",
    confidenceMeaning: "0.89 means the note is directly attributable to a staff author.",
    importanceScore: 62,
    importanceReason: "Scheduling gaps matter, but stay below symptom escalation.",
    deterministicFloor: "Open scheduling gaps cannot rank below MODERATE.",
    wrongOutcome:
      "If wrong, the task can be corrected without exposing the patient to internal notes.",
  },
  {
    id: "e2",
    date: "15 Apr 2025",
    time: "09:20",
    author: "Nightingale AI",
    role: "system",
    type: "Internal AI consult analysis",
    content:
      "Documented penicillin allergy: previous facial swelling after amoxicillin. Clinician confirmed allergy and advised avoidance.",
    allowedRoles: ["clinician", "admin"],
    version: 1,
    accent: "violet",
    ai: true,
    aiMode: "raw",
    approval: "needs-review",
    provenance: "session-ai-1",
    extractionMode: "generated",
    validationTarget: "Validated only if the quoted source span resolves exactly",
    riskLevel: "high",
    confidenceScore: 0.84,
    confidenceLabel: "medium",
    confidenceMeaning: "0.84 means source-linked but still requires human reconciliation.",
    importanceScore: 82,
    importanceReason: "Allergy class has a fixed safety floor.",
    deterministicFloor: "Allergy-related medication items cannot rank below HIGH.",
    wrongOutcome:
      "If wrong, the care team must reconcile before the alert can be closed.",
  },
  {
    id: "e1",
    date: "15 Apr 2025",
    time: "09:05",
    author: "Clinic care team",
    role: "system",
    type: "Patient instruction",
    content:
      "Penicillin allergy remains on the active safety list. Avoid amoxicillin and tell the clinic before any new medication starts.",
    allowedRoles: ["patient", "staff", "clinician", "admin"],
    version: 1,
    accent: "gray",
    patientVisible: true,
    provenance: "Approved care instruction linked to allergy record",
    extractionMode: "extractive",
    validationTarget: "Validated against allergy list and clinician confirmation",
    riskLevel: "high",
    confidenceScore: 0.95,
    confidenceLabel: "high",
    confidenceMeaning:
      "0.95 means the instruction resolves to a confirmed allergy record.",
    importanceScore: 86,
    importanceReason: "Medication safety instructions keep a high minimum floor.",
    deterministicFloor: "Confirmed allergy instructions cannot rank below HIGH.",
    wrongOutcome:
      "If wrong, release pauses and the care team reviews the allergy record.",
  },
];

const allHighlights: Highlight[] = [
  {
    id: "h1",
    title: "Penicillin allergy",
    reason: "Medication safety with a confirmed allergy signal",
    source: "e2",
    label: "Internal AI consult · 15 Apr 2025",
    tone: "red",
    riskLevel: "high",
    confidenceScore: 0.84,
    confidenceLabel: "medium",
    importanceScore: 82,
    deterministicFloor: "Allergy signals cannot rank below HIGH.",
  },
  {
    id: "h2",
    title: "Chest tightness for 3 days",
    reason: "Recent symptom remains unresolved",
    source: "e5",
    label: "Raw AI-scribed note · today",
    tone: "orange",
    riskLevel: "high",
    confidenceScore: 0.67,
    confidenceLabel: "medium",
    importanceScore: 76,
    deterministicFloor: "Chest symptoms keep a high floor until reviewed.",
  },
  {
    id: "h3",
    title: "ECG needs scheduling",
    reason: "Open task with unresolved follow-up",
    source: "e3",
    label: "Staff note · yesterday",
    tone: "blue",
    riskLevel: "moderate",
    confidenceScore: 0.89,
    confidenceLabel: "high",
    importanceScore: 62,
    deterministicFloor: "Open scheduling gaps cannot rank below MODERATE.",
  },
  {
    id: "h4",
    title: "Approved next steps ready",
    reason: "Patient-facing AI summary was reviewed before release",
    source: "e6",
    label: "Clinic web app summary · today",
    tone: "blue",
    riskLevel: "high",
    confidenceScore: 0.92,
    confidenceLabel: "high",
    importanceScore: 90,
    deterministicFloor: "Patient release requires clinician approval.",
  },
  {
    id: "h5",
    title: "AI withheld from patient",
    reason: "Raw AI content abstained until a human approves a patient-safe summary",
    source: "e5",
    label: "Safety abstention · today",
    tone: "orange",
    riskLevel: "high",
    confidenceScore: 1,
    confidenceLabel: "high",
    importanceScore: 94,
    deterministicFloor: "Patient-facing generation has a human approval gate.",
    abstained: true,
    abstainReason: "Raw AI note blocked from patient view",
  },
];

const allConflicts: Conflict[] = [
  {
    id: "c1",
    title: "Medication conflict detected",
    detail:
      "Staff note shows amoxicillin 500 mg while clinician plan says stop amoxicillin 250 mg and reconcile allergy.",
    severity: "high",
    visibleTo: ["staff", "clinician", "admin"],
  },
  {
    id: "c2",
    title: "Allergy vs medication list",
    detail:
      "Confirmed penicillin allergy conflicts with amoxicillin still appearing in active workflow notes.",
    severity: "high",
    visibleTo: ["staff", "clinician", "admin"],
  },
];

export function getWorkspaceUser(role: Role) {
  if (role === "patient") return "Alex Tan";
  if (role === "staff") return "Nurse Sofia Lim";
  return "Dr Maya Chen";
}

export function getStructuredType(role: Role, title: string) {
  if (role === "staff") return `Staff note · ${title}`;
  if (role === "admin") return `Admin oversight update · ${title}`;
  return `Clinician section · ${title}`;
}

export function toneForRisk(
  riskLevel: Entry["riskLevel"],
): Highlight["tone"] {
  if (riskLevel === "critical") return "red";
  if (riskLevel === "high") return "orange";
  return "blue";
}

export function buildWorkspace(role: Role): WorkspacePayload {
  const entries = allEntries.filter((entry) => entry.allowedRoles.includes(role));
  const visibleEntryIds = new Set(entries.map((entry) => entry.id));
  const preferredHighlightIds = role === "patient" ? ["h4", "h5"] : ["h1", "h2", "h3"];
  const highlights = allHighlights.filter(
    (highlight) =>
      preferredHighlightIds.includes(highlight.id) &&
      (visibleEntryIds.has(highlight.source) ||
        Boolean(highlight.abstained && role === "patient")),
  );
  const conflicts = allConflicts.filter((conflict) => conflict.visibleTo.includes(role));

  return {
    role,
    roleLabel: roleLabels[role],
    roleCapability: roleCapabilities[role],
    patient: {
      id: "patient-1",
      name: "Alex Tan",
      age: 42,
      identifier: "S1234567D",
      lastUpdated: "2 min ago",
    },
    profile: getDefaultPatientProfile(),
    entries,
    highlights,
    conflicts,
  };
}
