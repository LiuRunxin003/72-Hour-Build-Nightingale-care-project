from app.service import Actor, analyze_redaction


def test_redaction_reports_residual_safety():
    report = analyze_redaction("Alex Tan S1234567D called from +65 9123 4567.")

    assert report["is_safe"] is True
    assert report["replacements"]["names"] == 1
    assert report["replacements"]["national_ids"] == 1
    assert report["replacements"]["phones"] == 1
    assert report["residual_findings"] == []


def test_conflict_detection_flags_medication_and_allergy(svc, clinician):
    conflicts = svc.conflict_summary(clinician, "patient-1")

    assert conflicts
    assert any(item["type"] == "medication_dosage" for item in conflicts)
    assert any(item["type"] == "allergy_medication" for item in conflicts)


def test_patient_facing_summary_requires_human_approval(svc):
    patient_actor = Actor("patient-1", "patient", "clinic-a", "patient-1")
    clinician_actor = Actor("dr-1", "clinician", "clinic-a")
    patient_visible_entry = next(
        item
        for item in svc.entries.values()
        if item.patient_visible and not item.raw_ai and item.author_role == "clinician"
    )
    raw_ai_entry = next(item for item in svc.entries.values() if item.raw_ai)

    raw_result = svc.patient_summary_status(clinician_actor, raw_ai_entry.id)
    patient_result = svc.patient_summary_status(patient_actor, patient_visible_entry.id)
    approved_result = svc.patient_summary_status(clinician_actor, patient_visible_entry.id)

    assert raw_result["status"] == "abstain"
    assert patient_result["status"] == "needs_review"
    assert approved_result["status"] == "approved"
