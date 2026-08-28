import pytest
from app.service import VersionConflict

def test_different_entries_do_not_overwrite(svc,clinician,staff):
    ce=next(e for e in svc.entries.values() if e.author_role=="clinician")
    se=next(e for e in svc.entries.values() if e.author_role=="staff")
    svc.edit_entry(clinician,ce.id,"Doctor edit",1); svc.edit_entry(staff,se.id,"Staff edit",1)
    assert svc.entries[ce.id].content=="Doctor edit" and svc.entries[se.id].content=="Staff edit"
def test_same_entry_has_deterministic_conflict(svc,clinician):
    e=next(x for x in svc.entries.values() if x.author_role=="clinician")
    svc.edit_entry(clinician,e.id,"First writer wins",1)
    with pytest.raises(VersionConflict): svc.edit_entry(clinician,e.id,"Stale overwrite",1)
    assert svc.entries[e.id].content=="First writer wins"
