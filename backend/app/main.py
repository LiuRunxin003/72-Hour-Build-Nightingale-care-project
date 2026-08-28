from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from .service import (
    Actor,
    CareNoteService,
    Forbidden,
    VersionConflict,
    analyze_redaction,
)

app = FastAPI(title="Nightingale Care Note API", version="0.1.0")
service = CareNoteService().seed()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/patients/{patient_id}/timeline")
def timeline(
    patient_id: str,
    x_role: str = Header(...),
    x_user_id: str = Header(...),
    x_clinic_id: str = Header("clinic-a"),
):
    try:
        actor = Actor(x_user_id, x_role, x_clinic_id, patient_id if x_role == "patient" else None)
        return [entry.__dict__ for entry in service.timeline(actor, patient_id)]
    except Forbidden as error:
        raise HTTPException(403, str(error))


@app.get("/patients/{patient_id}/conflicts")
def conflicts(
    patient_id: str,
    x_role: str = Header(...),
    x_user_id: str = Header(...),
    x_clinic_id: str = Header("clinic-a"),
):
    try:
        actor = Actor(x_user_id, x_role, x_clinic_id, patient_id if x_role == "patient" else None)
        return service.conflict_summary(actor, patient_id)
    except Forbidden as error:
        raise HTTPException(403, str(error))


class Edit(BaseModel):
    content: str
    expected_version: int


@app.put("/entries/{entry_id}")
def edit(
    entry_id: str,
    payload: Edit,
    x_role: str = Header(...),
    x_user_id: str = Header(...),
    x_clinic_id: str = Header("clinic-a"),
):
    try:
        actor = Actor(x_user_id, x_role, x_clinic_id)
        return service.edit_entry(actor, entry_id, payload.content, payload.expected_version).__dict__
    except Forbidden as error:
        raise HTTPException(403, str(error))
    except VersionConflict as error:
        raise HTTPException(409, str(error))


class Scribe(BaseModel):
    transcript: str
    session_id: str
    patient_id: str


@app.post("/ai/scribe")
def scribe(payload: Scribe):
    report = analyze_redaction(payload.transcript)
    return {
        "redacted_input": report["redacted_text"],
        "summary": report["redacted_text"][:400],
        "provenance_pointer": payload.session_id,
        "redaction_report": {
            "replacements": report["replacements"],
            "is_safe": report["is_safe"],
            "residual_findings": report["residual_findings"],
        },
    }
