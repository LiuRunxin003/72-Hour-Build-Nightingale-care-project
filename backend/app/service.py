from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime, timezone
import re
from uuid import uuid4


class Forbidden(Exception):
    pass


class NotFound(Exception):
    pass


class VersionConflict(Exception):
    pass


RISK_ORDER = {"low": 1, "moderate": 2, "high": 3, "critical": 4}
CONFIDENCE_BANDS = ((0.85, "high"), (0.60, "medium"), (0.0, "low"))
RISK_RULES = (
    ("critical", ("anaphylaxis", "syncope", "fainting", "chest pain at rest")),
    ("high", ("allergy", "facial swelling", "chest tightness", "breathlessness")),
    ("moderate", ("medication", "ecg", "dosage", "follow-up")),
)
MEDICATION_PATTERN = re.compile(
    r"(?i)\b(amoxicillin|penicillin|aspirin|metformin|atorvastatin)\b"
)
DOSAGE_PATTERN = re.compile(r"(?i)\b(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml)\b")
ALLERGY_PATTERN = re.compile(r"(?i)\b(allergy|allergic|avoid)\b")
NAME_PATTERN = re.compile(r"(?i)\b(?:Alex Tan|Maya Chen|Sofia Lim)\b")
SG_ID_PATTERN = re.compile(r"\b[STFG]\d{7}[A-Z]\b", flags=re.I)
PHONE_PATTERN = re.compile(r"(?<!\d)(?:\+65\s*)?[689]\d{3}[ -]?\d{4}(?!\d)")


@dataclass
class Actor:
    id: str
    role: str
    clinic_id: str = "clinic-a"
    patient_id: str | None = None


@dataclass
class Entry:
    id: str
    patient_id: str
    clinic_id: str
    author_id: str
    author_role: str
    entry_type: str
    content: str
    patient_visible: bool = False
    raw_ai: bool = False
    provenance_pointer: str | None = None
    version: int = 1
    versions: list[dict] = field(default_factory=list)


def normalize_confidence(score: float) -> dict:
    rounded = round(max(0.0, min(1.0, score)), 2)
    for threshold, label in CONFIDENCE_BANDS:
        if rounded >= threshold:
            return {"score": rounded, "label": label}
    return {"score": rounded, "label": "low"}


def deterministic_risk_floor(text: str) -> dict:
    lowered = text.lower()
    matched_rules: list[str] = []
    risk_floor = "low"
    for candidate_level, keywords in RISK_RULES:
        matches = [keyword for keyword in keywords if keyword in lowered]
        if not matches:
            continue
        matched_rules.extend(matches)
        if RISK_ORDER[candidate_level] > RISK_ORDER[risk_floor]:
            risk_floor = candidate_level
    return {"risk_floor": risk_floor, "matched_rules": matched_rules}


def score_importance(topic: str, risk_level: str, feedback_weight: int = 0) -> int:
    base = 35
    topic_bonus = {"allergy": 20, "medication": 18, "dosage": 16, "symptom": 14}.get(
        topic, 8
    )
    risk_bonus = {"low": 0, "moderate": 12, "high": 24, "critical": 40}[risk_level]
    minimum_floor = {"low": 35, "moderate": 48, "high": 70, "critical": 90}[risk_level]
    return max(minimum_floor, base + topic_bonus + risk_bonus + feedback_weight)


def analyze_redaction(text: str) -> dict:
    redacted = redact_phi(text)
    residual_findings = []
    if NAME_PATTERN.search(redacted):
        residual_findings.append("name")
    if SG_ID_PATTERN.search(redacted):
        residual_findings.append("national_id")
    if PHONE_PATTERN.search(redacted):
        residual_findings.append("phone")
    return {
        "redacted_text": redacted,
        "replacements": {
            "names": len(NAME_PATTERN.findall(text)),
            "national_ids": len(SG_ID_PATTERN.findall(text)),
            "phones": len(PHONE_PATTERN.findall(text)),
        },
        "residual_findings": residual_findings,
        "is_safe": not residual_findings,
    }


def build_patient_safe_summary(entry: Entry, approved_by: str | None = None) -> dict:
    if entry.raw_ai:
        return {
            "status": "abstain",
            "reason": "raw_ai_source_requires_human_summary",
            "patient_visible": False,
        }
    if not entry.patient_visible:
        return {
            "status": "abstain",
            "reason": "source_not_marked_patient_visible",
            "patient_visible": False,
        }
    if approved_by is None:
        return {
            "status": "needs_review",
            "reason": "human_approval_required",
            "patient_visible": False,
        }
    return {
        "status": "approved",
        "reason": "human_approved_patient_summary",
        "patient_visible": True,
        "approved_by": approved_by,
        "summary": entry.content,
    }


def detect_conflicts(entries: list[Entry]) -> list[dict]:
    findings: dict[tuple[str, str], dict] = {}
    for entry in entries:
        medication = MEDICATION_PATTERN.search(entry.content)
        dosage = DOSAGE_PATTERN.search(entry.content)
        allergy = ALLERGY_PATTERN.search(entry.content)

        if medication and dosage:
            key = ("medication_dosage", medication.group(1).lower())
            dosage_value = f"{dosage.group(1)} {dosage.group(2).lower()}"
            bucket = findings.setdefault(
                key,
                {"type": key[0], "subject": key[1], "values": {}, "entry_ids": []},
            )
            bucket["values"].setdefault(dosage_value, []).append(entry.id)
            bucket["entry_ids"].append(entry.id)

        if medication and allergy:
            key = ("allergy_medication", medication.group(1).lower())
            bucket = findings.setdefault(
                key,
                {"type": key[0], "subject": key[1], "values": {}, "entry_ids": []},
            )
            bucket["values"].setdefault("allergy_flagged", []).append(entry.id)
            bucket["entry_ids"].append(entry.id)

    conflicts = []
    for item in findings.values():
        value_count = len([value for value, ids in item["values"].items() if ids])
        if item["type"] == "medication_dosage" and value_count > 1:
            conflicts.append(
                {
                    **item,
                    "severity": "high",
                    "reason": "Conflicting dosages found for the same medication.",
                }
            )
        if item["type"] == "allergy_medication":
            conflicts.append(
                {
                    **item,
                    "severity": "high",
                    "reason": "Medication appears in an allergy-related note and should be reconciled.",
                }
            )
    return conflicts


class CareNoteService:
    def __init__(self):
        self.entries = {}
        self.highlights = {}
        self.audit = []
        self.topic_weights = {}

    def seed(self):
        self.create_entry(
            Actor("dr-1", "clinician"),
            "patient-1",
            "clinician_note",
            "Arrange ECG and medication review. Avoid amoxicillin because penicillin allergy remains active.",
            True,
        )
        self.create_entry(
            Actor("nurse-1", "staff"),
            "patient-1",
            "staff_note",
            "ECG appointment is not booked. Medication list still shows amoxicillin 500 mg.",
        )
        self.create_entry(
            Actor("dr-1", "clinician"),
            "patient-1",
            "clinician_plan",
            "Stop amoxicillin 250 mg and confirm allergy reconciliation before next dose.",
        )
        self.create_entry(
            Actor("system", "system"),
            "patient-1",
            "ai_doctor_consult_summary",
            "Penicillin allergy caused facial swelling.",
            False,
            True,
            "session-ai-1",
        )
        return self

    def _scope(self, actor, clinic_id):
        if actor.clinic_id != clinic_id:
            raise Forbidden("cross-clinic access denied")

    def create_entry(
        self,
        actor,
        patient_id,
        entry_type,
        content,
        patient_visible=False,
        raw_ai=False,
        provenance=None,
    ):
        allowed = {
            "staff": {"staff_note"},
            "clinician": {"clinician_note", "clinician_plan"},
            "system": {
                "ai_doctor_consult_summary",
                "ai_nurse_consult_summary",
                "ai_patient_session_summary",
            },
            "admin": {"admin_note"},
        }
        if entry_type not in allowed.get(actor.role, set()):
            raise Forbidden("role cannot author this entry type")
        entry = Entry(
            str(uuid4()),
            patient_id,
            actor.clinic_id,
            actor.id,
            actor.role,
            entry_type,
            content,
            patient_visible,
            raw_ai,
            provenance,
        )
        entry.versions.append({"version": 1, "content": content, "changed_by": actor.id})
        self.entries[entry.id] = entry
        self._log(actor, "create", entry.id, {"version": 1})
        return entry

    def timeline(self, actor, patient_id):
        out = []
        for entry in self.entries.values():
            if entry.patient_id != patient_id:
                continue
            self._scope(actor, entry.clinic_id)
            if actor.role == "patient" and (
                actor.patient_id != patient_id
                or not entry.patient_visible
                or entry.raw_ai
            ):
                continue
            out.append(deepcopy(entry))
        return out

    def scoped_entries(self, actor, patient_id):
        rows = []
        for entry in self.entries.values():
            if entry.patient_id != patient_id:
                continue
            self._scope(actor, entry.clinic_id)
            rows.append(deepcopy(entry))
        return rows

    def edit_entry(self, actor, entry_id, content, expected_version):
        entry = self.entries.get(entry_id)
        if not entry:
            raise NotFound(entry_id)
        self._scope(actor, entry.clinic_id)
        if actor.role != entry.author_role and actor.role != "admin":
            raise Forbidden("roles cannot overwrite each other's notes")
        if expected_version != entry.version:
            raise VersionConflict(f"expected {expected_version}, current {entry.version}")
        entry.version += 1
        entry.content = content
        entry.versions.append(
            {"version": entry.version, "content": content, "changed_by": actor.id}
        )
        self._log(actor, "edit", entry.id, {"version": entry.version})
        return deepcopy(entry)

    def revert(self, actor, entry_id, target_version, expected_version):
        entry = self.entries[entry_id]
        prior = next(
            (version for version in entry.versions if version["version"] == target_version),
            None,
        )
        if not prior:
            raise NotFound("version")
        restored = self.edit_entry(actor, entry_id, prior["content"], expected_version)
        self._log(
            actor,
            "revert",
            entry_id,
            {"from_version": target_version, "new_version": restored.version},
        )
        return restored

    def highlight(self, actor, entry_id, start, end, risk_reason, topic="general"):
        entry = self.entries[entry_id]
        self._scope(actor, entry.clinic_id)
        if not 0 <= start < end <= len(entry.content):
            raise ValueError("invalid source span")

        risk_analysis = deterministic_risk_floor(entry.content)
        confidence_score = 0.91 if risk_analysis["risk_floor"] in {"high", "critical"} else 0.67
        confidence = normalize_confidence(confidence_score)
        feedback_weight = self.topic_weights.get(topic, 0)
        importance = score_importance(topic, risk_analysis["risk_floor"], feedback_weight)

        highlight = {
            "id": str(uuid4()),
            "source_entry_id": entry_id,
            "source_version": entry.version,
            "start_offset": start,
            "end_offset": end,
            "quoted_text": entry.content[start:end],
            "risk_reason": risk_reason,
            "risk_floor": risk_analysis["risk_floor"],
            "matched_rules": risk_analysis["matched_rules"],
            "confidence": confidence,
            "importance_score": importance,
            "importance_reason": "Deterministic floor + topic class + reviewed feedback weight.",
            "provenance_pointer": f"entry:{entry_id}:v{entry.version}:{start}-{end}",
            "topic": topic,
            "priority": importance,
            "abstain": False,
        }
        self.highlights[highlight["id"]] = highlight
        return deepcopy(highlight)

    def resolve_provenance(self, highlight_id):
        highlight = self.highlights[highlight_id]
        entry = self.entries[highlight["source_entry_id"]]
        version = next(
            version
            for version in entry.versions
            if version["version"] == highlight["source_version"]
        )
        assert (
            version["content"][highlight["start_offset"] : highlight["end_offset"]]
            == highlight["quoted_text"]
        )
        return entry, version

    def pin(self, highlight_id):
        topic = self.highlights[highlight_id]["topic"]
        self.topic_weights[topic] = self.topic_weights.get(topic, 0) + 10

    def conflict_summary(self, actor, patient_id):
        if actor.role == "patient":
            return []
        return detect_conflicts(self.scoped_entries(actor, patient_id))

    def patient_summary_status(self, actor, entry_id):
        entry = self.entries.get(entry_id)
        if not entry:
            raise NotFound(entry_id)
        self._scope(actor, entry.clinic_id)
        approved_by = actor.id if actor.role in {"clinician", "admin"} else None
        return build_patient_safe_summary(entry, approved_by)

    def _log(self, actor, action, target, metadata):
        self.audit.append(
            {
                "actor_id": actor.id,
                "actor_role": actor.role,
                "action": action,
                "target_id": target,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": metadata,
            }
        )


def redact_phi(text):
    text = SG_ID_PATTERN.sub("[REDACTED_ID]", text)
    text = PHONE_PATTERN.sub("[REDACTED_PHONE]", text)
    return NAME_PATTERN.sub("[REDACTED_NAME]", text)
