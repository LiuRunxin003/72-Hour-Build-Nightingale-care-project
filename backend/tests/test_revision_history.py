def test_edit_increments_version_and_audits(svc,clinician):
    e=next(x for x in svc.entries.values() if x.author_role=="clinician")
    updated=svc.edit_entry(clinician,e.id,"Updated plan",1)
    assert updated.version==2 and len(updated.versions)==2
    assert svc.audit[-1]["actor_id"]==clinician.id and svc.audit[-1]["action"]=="edit"
def test_revert_creates_new_version(svc,clinician):
    e=next(x for x in svc.entries.values() if x.author_role=="clinician"); original=e.content
    svc.edit_entry(clinician,e.id,"Changed",1); reverted=svc.revert(clinician,e.id,1,2)
    assert reverted.content==original and reverted.version==3
