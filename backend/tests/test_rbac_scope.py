import pytest
from app.service import Actor, Forbidden

def test_roles_cannot_edit_each_other(svc,clinician,staff):
    se=next(e for e in svc.entries.values() if e.author_role=="staff")
    with pytest.raises(Forbidden): svc.edit_entry(clinician,se.id,"overwrite",1)
    ce=next(e for e in svc.entries.values() if e.author_role=="clinician")
    with pytest.raises(Forbidden): svc.edit_entry(staff,ce.id,"overwrite",1)
def test_patient_cannot_see_internal_or_raw_ai(svc):
    rows=svc.timeline(Actor("patient-1","patient","clinic-a","patient-1"),"patient-1")
    assert rows and all(e.patient_visible and not e.raw_ai for e in rows)
def test_clinic_scope(svc):
    with pytest.raises(Forbidden): svc.timeline(Actor("intruder","clinician","clinic-b"),"patient-1")
