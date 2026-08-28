def test_pin_increases_similar_topic_priority(svc,clinician):
    e=next(x for x in svc.entries.values() if x.raw_ai); end=len("Penicillin")
    first=svc.highlight(clinician,e.id,0,end,"Allergy","allergy"); svc.pin(first["id"])
    second=svc.highlight(clinician,e.id,0,end,"Allergy","allergy")
    assert second["priority"]>first["priority"]
