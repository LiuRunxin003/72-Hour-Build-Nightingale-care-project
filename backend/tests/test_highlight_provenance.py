def test_highlight_resolves_exact_span(svc, clinician):
    entry = next(item for item in svc.entries.values() if item.raw_ai)
    start = entry.content.index("Penicillin")
    end = start + len("Penicillin allergy")
    highlight = svc.highlight(clinician, entry.id, start, end, "Medication safety", "allergy")
    resolved_entry, version = svc.resolve_provenance(highlight["id"])

    assert highlight["provenance_pointer"]
    assert resolved_entry.id == entry.id
    assert version["content"][start:end] == highlight["quoted_text"]
    assert highlight["risk_floor"] in {"high", "critical"}
    assert highlight["confidence"]["score"] >= 0.85
    assert highlight["importance_score"] >= 70
