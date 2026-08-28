# Nightingale Care Note

## Demo Video

Click the image below to watch the project demonstration on YouTube.

[![Watch the demo video](docs/demo-cover.png)](https://youtu.be/jOY85FPJeDA?si=O7jt4WmfVNw4SX_E)
Working MVP for a shared longitudinal clinical note. Synthetic data only.

## Included

- Demo lock screen (username 111, password 124)
- Clickable patient identity with a scrollable recent-condition drawer
- Structured clinician/nurse update form
- Comment draft cancellation and posted-comment undo
- Consult Glance with risk reasons and source links
- Timeline with manual and clearly labelled AI-scribed entries
- Clinician, staff, patient, and admin views
- Comments, mentions, tasks, highlights, provenance, versions and revert UI
- Server-side RBAC rules and clinic scoping
- Deterministic concurrent-edit conflicts
- Pre-LLM name, Singapore NRIC/FIN, and phone redaction
- Explainable importance feedback and all required micro-tests

The browser uses representative demo data. The FastAPI service contains the enforceable backend rules. Connect UI fetch calls to it before production use.

The username/password lock is intentionally a client-side candidate-demo gate, not production authentication. Production must use server-side identity, secure password hashing or SSO, sessions, rate limits, and audit logging.

## Requirements

- Node.js 22+
- Python 3.11+
- VS Code

## Run the web interface

Open this folder in VS Code and run:

    npm install
    npm run dev

Open the URL printed in Terminal, normally http://localhost:3000.

## Run the API

In a second VS Code terminal:

    cd backend
    python -m venv .venv

Windows PowerShell:

    .venv\\Scripts\\Activate.ps1
    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000

macOS/Linux activation: source .venv/bin/activate

API documentation: http://127.0.0.1:8000/docs

## Run tests

From backend with the environment active:

    pytest -v

Expected result: 9 tests pass.

## Security and privacy

The browser role selector is for demonstration. Actual authorization is in backend/app/service.py. Every read checks clinic_id. Patient responses require matching patient_id and filter raw AI entries. Writes verify author role. Staff cannot overwrite clinician entries and clinicians cannot overwrite staff entries.

redact_phi runs before the LLM boundary in the AI scribe endpoint. Production should add multilingual NER, encryption, TLS, PostgreSQL RLS, consent, retention, and human review. Never log raw transcripts.

## Revisions and concurrency

Every edit appends an immutable full snapshot and increments version. Revert copies an old snapshot into a new version. Clients send expected_version; stale edits receive 409 Conflict and never silently overwrite work. Audit records contain actor, action, time, and version metadata.

## Provenance

Highlights retain source_entry_id, source version, exact character offsets, quoted text, and risk reason. The service verifies the quote against the immutable source. Glance links scroll to and flash the corresponding timeline entry.

## Warm-path latency

Benchmark a cached glance endpoint after wiring PostgreSQL. Run 20 warm-ups and 500 measured requests, sort durations, and report P95. Index clinic_id, patient_id, created_at, and unresolved filters. Target P95 is 300 ms or less. Do not claim a number until measured on the final deployment.

## Suggested demo

1. Explain the top card in under 10 seconds.
2. Click View source to jump to exact provenance.
3. Add a note/comment and highlight a phrase.
4. Open Revision history and demonstrate revert.
5. Switch to Patient and show raw AI/internal information disappears.
6. Run pytest -v and show the required tests passing.

## Scope decisions

- Full snapshots instead of diffs: simpler audit and restore.
- Optimistic locking instead of a Google Docs-style CRDT.
- Transparent feedback weights instead of an opaque trained model.
- Voice, diarization, and hybrid data decay are extensions.

See ATTRIBUTION.txt for libraries and licenses.
