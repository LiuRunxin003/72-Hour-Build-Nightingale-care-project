"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import "./care.css";
import {
  buildWorkspace,
  getDefaultPatientProfile,
  getStructuredType,
  getWorkspaceUser,
  roleCapabilities,
  roleLabels,
  toneForRisk,
  type Entry,
  type PatientProfile,
  type Role,
  type WorkspacePayload,
} from "@/lib/workspace-data";

type Comment = { id: string; author: string; text: string };

function canAddStructuredUpdate(role: Role) {
  return role !== "patient";
}

function canComment(role: Role) {
  return role !== "patient";
}

export default function Home() {
  const [unlocked, setUnlocked] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginRole, setLoginRole] = useState<Role>("clinician");
  const [loginError, setLoginError] = useState("");
  const [role, setRole] = useState<Role>("clinician");
  const [tab, setTab] = useState<"timeline" | "tasks" | "history">("timeline");
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const [commentOn, setCommentOn] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [comments, setComments] = useState<Record<string, Comment[]>>({
    e3: [{ id: "cmt-1", author: "Sofia Lim", text: "@clinician ECG slot requested for today." }],
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [patientProfile, setPatientProfile] = useState<PatientProfile>(getDefaultPatientProfile());
  const [form, setForm] = useState({
    title: "",
    date: "2026-08-27",
    status: "Active",
    severity: "Moderate",
    synopsis: "",
    patientVisible: false,
  });

  useEffect(() => {
    if (!unlocked) {
      return;
    }

    let cancelled = false;

    async function loadWorkspace() {
      setWorkspaceLoading(true);
      setWorkspaceError("");
      try {
        const response = await fetch(`/api/workspace?role=${role}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`workspace request failed with ${response.status}`);
        }
        const payload = (await response.json()) as WorkspacePayload;
        if (cancelled) {
          return;
        }
        setWorkspace(payload);
        setPatientProfile(payload.profile);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const fallback = buildWorkspace(role);
        setWorkspace(fallback);
        setPatientProfile(fallback.profile);
        setWorkspaceError(
          error instanceof Error
            ? `Live workspace API failed, showing fallback data. ${error.message}`
            : "Live workspace API failed, showing fallback data.",
        );
      } finally {
        if (!cancelled) {
          setWorkspaceLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [unlocked, role]);

  const visibleEntries = workspace?.entries ?? [];
  const visibleHighlights = workspace?.highlights ?? [];
  const visibleConflicts = workspace?.conflicts ?? [];
  const visibleEntryIds = useMemo(
    () => new Set(visibleEntries.map((entry) => entry.id)),
    [visibleEntries],
  );

  const computedBmi = useMemo(() => {
    const heightCm = Number(patientProfile.heightCm);
    const weightKg = Number(patientProfile.weightKg);
    if (!heightCm || !weightKg) return "";
    const heightM = heightCm / 100;
    return (weightKg / (heightM * heightM)).toFixed(1);
  }, [patientProfile.heightCm, patientProfile.weightKg]);

  useEffect(() => {
    if (!pendingSourceId || tab !== "timeline") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const el = document.getElementById(pendingSourceId);
      if (!el || !visibleEntryIds.has(pendingSourceId)) {
        setToast("This source is hidden for the current access domain.");
        setPendingSourceId(null);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("source-pulse");
      window.setTimeout(() => el.classList.remove("source-pulse"), 1800);
      setPendingSourceId(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pendingSourceId, tab, visibleEntryIds]);

  function login(e: FormEvent) {
    e.preventDefault();
    if (username === "111" && password === "124") {
      setRole(loginRole);
      setUnlocked(true);
      setLoginError("");
      return;
    }
    setLoginError("Incorrect username or password. Try 111 / 124.");
  }

  function logout() {
    setUnlocked(false);
    setWorkspace(null);
    setWorkspaceError("");
    setToast("");
    setEditorOpen(false);
    setCommentOn(null);
    setCommentDraft("");
  }

  function jump(id: string) {
    if (!visibleEntryIds.has(id)) {
      setToast("This source is hidden for the current access domain.");
      return;
    }
    setTab("timeline");
    setPendingSourceId(id);
  }

  function addComment(id: string) {
    if (!commentDraft.trim() || !canComment(role)) return;
    setComments((current) => ({
      ...current,
      [id]: [
        ...(current[id] || []),
        { id: `c-${Date.now()}`, author: getWorkspaceUser(role), text: commentDraft },
      ],
    }));
    setCommentDraft("");
    setCommentOn(null);
    setToast("Comment posted to the clinic-only thread.");
  }

  function updateProfile(field: keyof PatientProfile, value: string) {
    setPatientProfile((current) => ({ ...current, [field]: value }));
  }

  function saveProfile() {
    const nextProfile = { ...patientProfile, bmi: computedBmi || patientProfile.bmi };
    setPatientProfile(nextProfile);
    setWorkspace((current) => (current ? { ...current, profile: nextProfile } : current));
    setToast("Patient profile updated for all workspace views.");
  }

  function saveStructured(e: FormEvent) {
    e.preventDefault();
    if (!canAddStructuredUpdate(role)) return;

    const now = new Date();
    const createdTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const createdEntry: Entry = {
      id: `local-${Date.now()}`,
      date: "27 Aug 2026",
      time: createdTime,
      author: getWorkspaceUser(role),
      role,
      type: getStructuredType(role, form.title),
      content: `${form.synopsis} Severity: ${form.severity}. Status: ${form.status}.`,
      allowedRoles: role === "staff" ? ["staff", "clinician", "admin"] : ["clinician", "admin"],
      version: 1,
      accent: role === "staff" ? "green" : "blue",
      provenance: "Direct signed workspace entry",
      extractionMode: "extractive",
      validationTarget: "Revision history and role-based author controls",
      riskLevel:
        form.severity === "Critical"
          ? "critical"
          : form.severity === "High"
            ? "high"
            : "moderate",
      confidenceScore: 0.95,
      confidenceLabel: "high",
      confidenceMeaning: "0.95 means this content was written directly by an authenticated user.",
      importanceScore: form.severity === "Critical" ? 95 : form.severity === "High" ? 82 : 58,
      importanceReason: "User-authored updates keep their deterministic severity floor.",
      deterministicFloor: "Critical and high severity items cannot be demoted by feedback alone.",
      wrongOutcome: "If wrong, the entry remains auditable and can be corrected with a new version.",
    };

    const generatedSummary: Entry | null = form.patientVisible
      ? {
          id: `summary-${Date.now()}`,
          date: "27 Aug 2026",
          time: createdTime,
          author: "Clinic web app summary",
          role: "system",
          type: "Patient-facing AI-assisted summary",
          content: `${form.title}: ${form.synopsis}`,
          allowedRoles: ["patient", "staff", "clinician", "admin"],
          version: 1,
          accent: "gray",
          patientVisible: true,
          ai: true,
          aiMode: "assisted",
          approval: role === "staff" ? "needs-review" : "approved",
          approvalBy: role === "staff" ? undefined : getWorkspaceUser(role),
          provenance: `Generated from ${createdEntry.type}`,
          extractionMode: "generated",
          validationTarget: "Released only after human review of source note",
          riskLevel: createdEntry.riskLevel,
          confidenceScore: role === "staff" ? 0.6 : 0.9,
          confidenceLabel: role === "staff" ? "medium" : "high",
          confidenceMeaning:
            role === "staff"
              ? "0.60 means the summary is draft quality until a clinician approves it."
              : "0.90 means the generated summary was reviewed before patient release.",
          importanceScore: Math.max(88, createdEntry.importanceScore),
          importanceReason: "Patient release keeps a higher safety floor than internal notes.",
          deterministicFloor: "Patient summaries require approval and abstain if unsupported.",
          wrongOutcome: "If wrong, release is blocked and the patient sees nothing new.",
        }
      : null;

    setWorkspace((current) => {
      if (!current) {
        return current;
      }
      const nextEntries =
        generatedSummary && generatedSummary.allowedRoles.includes(role)
          ? [generatedSummary, createdEntry, ...current.entries]
          : [createdEntry, ...current.entries];
      return { ...current, entries: nextEntries };
    });

    setEditorOpen(false);
    setForm({
      title: "",
      date: "2026-08-27",
      status: "Active",
      severity: "Moderate",
      synopsis: "",
      patientVisible: false,
    });
    setToast(
      form.patientVisible
        ? "Structured update saved. Patient-facing summary created with approval gating."
        : "Structured update saved to the clinic record.",
    );
  }

  if (!unlocked) {
    return (
      <main className="login-page">
        <div className="login-brand">
          <span className="login-mark">N</span>
          <strong>Nightingale</strong>
          <small>Clinical Care Workspace</small>
        </div>
        <section className="login-layout">
          <div className="login-story">
            <span className="login-kicker">ONE PATIENT STORY</span>
            <h1>
              Care context,
              <br />
              <em>from every visit.</em>
            </h1>
            <p>
              A provenance-first workspace where patient-safe summaries must be approved and
              internal AI output can abstain instead of guessing.
            </p>
            <div className="story-points">
              <span>01</span>
              <p>
                <b>Evaluate every badge</b>
                <small>Risk, confidence, and importance each need a failure mode.</small>
              </p>
            </div>
            <div className="story-points">
              <span>02</span>
              <p>
                <b>Protect patient release</b>
                <small>Generated patient content is clearly labeled and human approved.</small>
              </p>
            </div>
          </div>
          <form className="login-card" onSubmit={login}>
            <div className="login-card-top">
              <span>SECURE DEMO ACCESS</span>
              <i>•</i>
            </div>
            <h2>Welcome back</h2>
            <p>Sign in to open the patient workspace.</p>
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus placeholder="Enter username" />
            </label>
            <label>
              Password
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Enter password" />
            </label>
            <fieldset className="domain-picker">
              <legend>Domain</legend>
              <div className="domain-grid">
                {(Object.keys(roleLabels) as Role[]).map((domain) => (
                  <label key={domain} className={loginRole === domain ? "selected" : ""}>
                    <input type="radio" name="domain" checked={loginRole === domain} onChange={() => setLoginRole(domain)} />
                    <span>{roleLabels[domain]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="domain-help">{roleCapabilities[loginRole]}</p>
            {loginError && <div className="login-error" role="alert">{loginError}</div>}
            <label className="remember">
              <input type="checkbox" /> Remember me on this device
            </label>
            <button className="login-submit">
              Unlock workspace <span>→</span>
            </button>
            <small className="demo-hint">Demo credentials: 111 / 124</small>
          </form>
        </section>
        <footer className="login-footer">
          <span>Synthetic data only</span>
          <span>Evaluation-first demo</span>
          <span>Need help? Contact support</span>
        </footer>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">N</span>
          <div>
            <strong>Nightingale</strong>
            <small>Care workspace</small>
          </div>
        </div>
        <nav>
          <button className="active">
            ▦ <span>Patient workspace</span>
          </button>
          <button>
            ✓ <span>My tasks</span>
            <b>{role === "patient" ? 2 : 3}</b>
          </button>
          <button>
            ⌁ <span>Clinic activity</span>
          </button>
          <button>
            ⚙ <span>Administration</span>
          </button>
        </nav>
        <div className="privacy">
          <span>✓</span>
          <div>
            <strong>Synthetic data only</strong>
            <small>Privacy-safe demo</small>
          </div>
        </div>
        <div className="user">
          <div className="avatar">{role === "patient" ? "AT" : "MC"}</div>
          <div>
            <strong>{getWorkspaceUser(role)}</strong>
            <small>{roleLabels[role].toLowerCase()}</small>
          </div>
          <button className="lock-button" onClick={logout} title="Log out">
            Log out
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header>
          <button className="patient-identity" onClick={() => setTab("timeline")} aria-label="Open Alex Tan workspace">
            <span className="crumb">Patients / {workspace?.patient.name ?? "Alex Tan"}</span>
            <span className="patient-title">
              {workspace?.patient.name ?? "Alex Tan"} <em>Active</em> <i>Recent condition →</i>
            </span>
            <span className="patient-meta">
              {(workspace?.patient.age ?? 42).toString()} years · {workspace?.patient.identifier ?? "S1234567D"} · Last updated {workspace?.patient.lastUpdated ?? "2 min ago"}
            </span>
          </button>
          <div className="header-actions">
            {canAddStructuredUpdate(role) && (
              <button className="structured-button" onClick={() => setEditorOpen(true)}>
                {role === "staff" ? "+ Add staff note" : "+ Add structured update"}
              </button>
            )}
            <div className="role-summary">
              <label>{roleLabels[role]} domain</label>
              <small>{roleCapabilities[role]}</small>
            </div>
            <button className="logout-button" onClick={logout}>
              Log out
            </button>
          </div>
        </header>

        {workspaceError && <div className="patient-banner">{workspaceError}</div>}
        {workspaceLoading && <div className="patient-banner">Loading workspace data for the selected domain…</div>}

        <section className="profile-banner">
          <div className="profile-banner-head">
            <div>
              <span className="profile-kicker">PATIENT SNAPSHOT</span>
              <h2>Core clinical profile</h2>
              <p>Shared editable medical basics for every role.</p>
            </div>
            <button type="button" className="profile-save" onClick={saveProfile}>
              Save profile
            </button>
          </div>
          <div className="profile-grid">
            <label>
              <span>Height</span>
              <div className="profile-input-wrap">
                <input value={patientProfile.heightCm} onChange={(e) => updateProfile("heightCm", e.target.value)} inputMode="numeric" />
                <i>cm</i>
              </div>
            </label>
            <label>
              <span>Weight</span>
              <div className="profile-input-wrap">
                <input value={patientProfile.weightKg} onChange={(e) => updateProfile("weightKg", e.target.value)} inputMode="decimal" />
                <i>kg</i>
              </div>
            </label>
            <label>
              <span>BMI</span>
              <div className="profile-input-wrap readonly">
                <input value={computedBmi || patientProfile.bmi} readOnly />
                <i>calc</i>
              </div>
            </label>
            <label>
              <span>Blood pressure</span>
              <div className="profile-input-wrap">
                <input value={patientProfile.bloodPressure} onChange={(e) => updateProfile("bloodPressure", e.target.value)} />
                <i>mmHg</i>
              </div>
            </label>
            <label>
              <span>Pulse</span>
              <div className="profile-input-wrap">
                <input value={patientProfile.pulse} onChange={(e) => updateProfile("pulse", e.target.value)} inputMode="numeric" />
                <i>bpm</i>
              </div>
            </label>
            <label className="profile-wide">
              <span>Allergies</span>
              <div className="profile-input-wrap">
                <input value={patientProfile.allergies} onChange={(e) => updateProfile("allergies", e.target.value)} />
              </div>
            </label>
          </div>
        </section>

        {role === "patient" && (
          <div className="patient-banner">
            Patient view: only patient-facing summaries and instructions are shown. AI-assisted patient summaries are labeled and only appear after human approval.
          </div>
        )}

        <section className="glance">
          <div className="section-heading">
            <div>
              <span className="eyebrow">CONSULT GLANCE</span>
              <h2>What needs attention now</h2>
            </div>
            <span className="fresh">Updated 2 min ago</span>
          </div>
          <div className="highlight-grid">
            {visibleHighlights.map((highlight) => (
              <article key={highlight.id} className={`highlight ${highlight.tone}`}>
                <div className="risk-icon">
                  {highlight.tone === "red" ? "!" : highlight.tone === "orange" ? "↗" : "✓"}
                </div>
                <div>
                  <div className="metric-row">
                    <span className={`metric-chip ${toneForRisk(highlight.riskLevel)}`}>{highlight.riskLevel}</span>
                    <span className="metric-chip neutral">{Math.round(highlight.confidenceScore * 100)}% {highlight.confidenceLabel}</span>
                    <span className="metric-chip neutral">Importance {highlight.importanceScore}</span>
                  </div>
                  <h3>{highlight.title}</h3>
                  <p>{highlight.reason}</p>
                  <small className="metric-copy">Floor: {highlight.deterministicFloor}</small>
                  {highlight.abstained ? (
                    <small className="metric-copy">Abstained: {highlight.abstainReason}</small>
                  ) : (
                    <button onClick={() => jump(highlight.source)}>
                      View source <span>→</span>
                    </button>
                  )}
                  <small>{highlight.label}</small>
                </div>
              </article>
            ))}
          </div>
          <div className="glance-foot">
            <span>{visibleHighlights.length} prioritized items</span>
            <span>Ranking uses deterministic safety floors before recency or feedback.</span>
            <button onClick={() => setToast("Suggestions reviewed with safety floor preserved.")}>
              Review suggestions
            </button>
          </div>
        </section>

        <section className="glance trust-strip">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TRUST CHECK</span>
              <h2>How to read the numbers</h2>
            </div>
          </div>
          <div className="trust-check-grid">
            <article>
              <h3>Risk badge</h3>
              <p>It represents a deterministic floor, not a vibe. If the model drifts, the floor still holds.</p>
            </article>
            <article>
              <h3>Confidence</h3>
              <p>Shown numerically. If it is wrong, source linkage and review path should make that visible.</p>
            </article>
            <article>
              <h3>Importance</h3>
              <p>Feedback can raise ranking, but critical safety classes keep a minimum score floor.</p>
            </article>
            <article>
              <h3>Abstention</h3>
              <p>Patient-facing generation can be withheld entirely if approval or source support is missing.</p>
            </article>
          </div>
        </section>

        {visibleConflicts.length > 0 && (
          <section className="glance conflict-strip">
            <div className="section-heading">
              <div>
                <span className="eyebrow">CONFLICT DETECTION</span>
                <h2>Contradictions requiring reconciliation</h2>
              </div>
            </div>
            <div className="trust-check-grid">
              {visibleConflicts.map((conflict) => (
                <article key={conflict.id} className={conflict.severity === "high" ? "conflict-high" : ""}>
                  <h3>{conflict.title}</h3>
                  <p>{conflict.detail}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="tabs">
          <button className={tab === "timeline" ? "active" : ""} onClick={() => setTab("timeline")}>Timeline</button>
          <button className={tab === "tasks" ? "active" : ""} onClick={() => setTab("tasks")}>Open tasks <b>{role === "patient" ? 2 : 3}</b></button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Revision history</button>
        </div>

        {tab === "timeline" && (
          <div className="content-grid">
            <section className="timeline-panel">
              {canAddStructuredUpdate(role) && (
                <div className="structured-prompt">
                  <div>
                    <span>+</span>
                    <p>
                      <strong>{role === "staff" ? "Add staff note" : "Add clinician or admin update"}</strong>
                      <small>Generated patient summaries require visible approval or they abstain.</small>
                    </p>
                  </div>
                  <button onClick={() => setEditorOpen(true)}>Open editor</button>
                </div>
              )}
              <div className="feed">
                {visibleEntries.map((entry, index) => (
                  <article id={entry.id} className={`entry ${entry.accent}`} key={entry.id}>
                    <div className="rail">
                      <span></span>
                      {index < visibleEntries.length - 1 && <i />}
                    </div>
                    <div className="entry-card">
                      <div className="entry-top">
                        <div>
                          <strong>{entry.author}</strong>
                          <span className={`role ${entry.role}`}>{entry.role}</span>
                          {entry.ai && <span className="ai-chip">{entry.aiMode === "assisted" ? "AI-assisted" : "AI-scribed"}</span>}
                        </div>
                        <time>{entry.date} · {entry.time}</time>
                      </div>
                      <div className="metric-row">
                        <span className={`metric-chip ${toneForRisk(entry.riskLevel)}`}>{entry.riskLevel}</span>
                        <span className="metric-chip neutral">{Math.round(entry.confidenceScore * 100)}% {entry.confidenceLabel}</span>
                        <span className="metric-chip neutral">Importance {entry.importanceScore}</span>
                        {entry.approval && (
                          <span className={`metric-chip ${entry.approval === "approved" ? "blue" : entry.approval === "needs-review" ? "orange" : "red"}`}>
                            {entry.approval === "approved"
                              ? `Approved${entry.approvalBy ? ` by ${entry.approvalBy}` : ""}`
                              : entry.approval === "needs-review"
                                ? "Needs review"
                                : "Abstained"}
                          </span>
                        )}
                      </div>
                      <h3>{entry.type}</h3>
                      <p>{entry.content}</p>
                      <div className="provenance">Source: {entry.provenance} · {entry.extractionMode} · Validate: {entry.validationTarget}</div>
                      <div className="entry-facts">
                        <small>Floor: {entry.deterministicFloor}</small>
                        <small>Confidence: {entry.confidenceMeaning}</small>
                        <small>If wrong: {entry.wrongOutcome}</small>
                      </div>
                      {canComment(role) && (
                        <div className="entry-actions">
                          <button onClick={() => { setCommentOn(entry.id); setCommentDraft("@clinician "); }}>Comment</button>
                          <button onClick={() => setToast("Pinned, but deterministic floors remain in effect.")}>Highlight</button>
                          <button onClick={() => setToast(`Viewing version ${entry.version} and prior snapshots.`)}>Version {entry.version}</button>
                        </div>
                      )}
                      {canComment(role) &&
                        (comments[entry.id] || []).map((comment) => (
                          <div className="comment" key={comment.id}>
                            <div>
                              <strong>{comment.author}</strong>
                              <span>Just now</span>
                            </div>
                            <p>{comment.text}</p>
                          </div>
                        ))}
                      {canComment(role) && commentOn === entry.id && (
                        <div className="quick-comment">
                          <textarea value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} aria-label="Comment text" />
                          <div>
                            <button className="cancel-comment" onClick={() => { setCommentOn(null); setCommentDraft(""); }}>Cancel</button>
                            <button onClick={() => addComment(entry.id)}>Post</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="right-panel">
              <h3>{role === "patient" ? "Your next steps" : "Open care actions"}</h3>
              {(role === "patient"
                ? ["Book ECG appointment", "Read approved AI summary", "Escalate urgent symptoms immediately"]
                : ["Book ECG appointment", "Medication reconciliation", "Resolve allergy conflict"]).map((task, index) => (
                <div className="task" key={task}>
                  <input type="checkbox" />
                  <div>
                    <strong>{task}</strong>
                    <span>
                      {role === "patient"
                        ? index === 1
                          ? "Visible because a clinician approved the summary"
                          : "Patient-safe instruction"
                        : index === 2
                          ? "High-priority floor due to allergy conflict"
                          : "Clinic-scoped task"}
                    </span>
                  </div>
                </div>
              ))}
              <h3>Trust & provenance</h3>
              <div className="trust">
                <span>{role === "patient" ? "Safe" : "Audit"}</span>
                <p>{role === "patient" ? "You only see approved patient-facing AI summaries and direct instructions." : "Each surfaced item is source-linked, scored, and expected to abstain when unsupported."}</p>
              </div>
            </aside>
          </div>
        )}

        {tab === "tasks" && (
          <section className="simple-panel">
            <h2>{role === "patient" ? "Your tasks" : "Open tasks"}</h2>
            <p>{role === "patient" ? "Only approved patient-safe instructions appear here." : "Critical classes keep their ranking floor even if feedback is sparse or dismissals increase."}</p>
            {(role === "patient"
              ? ["Book ECG appointment - Patient", "Read approved AI summary - Patient", "Call clinic if symptoms worsen - Patient"]
              : ["Book ECG appointment - Staff", "Medication reconciliation - Dr Chen", "Resolve amoxicillin allergy conflict - Care team"]).map((item) => (
              <label className="task-row" key={item}>
                <input type="checkbox" />
                {item}
                <span>Open</span>
              </label>
            ))}
          </section>
        )}

        {tab === "history" && (
          <section className="simple-panel">
            <h2>Revision history</h2>
            <p>Every edit creates an immutable snapshot. If a generated output is wrong, the audit trail should show why it was released.</p>
            {[
              "v3 · Dr Maya Chen added escalation criteria",
              "v2 · Staff note introduced amoxicillin dosage conflict",
              "v1 · AI summary withheld until clinician approval",
            ].map((item, index) => (
              <div className="version-row" key={item}>
                <b>v{3 - index}</b>
                <div>
                  <strong>{item}</strong>
                  <span>27 Aug 2026</span>
                </div>
                <button onClick={() => setToast(`Opened ${item}.`)}>View & revert</button>
              </div>
            ))}
          </section>
        )}
      </section>

      {editorOpen && (
        <div className="overlay modal-overlay" onMouseDown={() => setEditorOpen(false)}>
          <form className="editor-modal" onSubmit={saveStructured} onMouseDown={(e) => e.stopPropagation()}>
            <div className="editor-title">
              <div>
                <span>STRUCTURED CARE NOTE</span>
                <h2>{role === "staff" ? "Add staff note" : "Add clinician or admin update"}</h2>
              </div>
              <button type="button" onClick={() => setEditorOpen(false)}>×</button>
            </div>
            <p className="editor-help">Decide extraction versus generation before saving. Patient-facing generation is higher severity and requires visible approval.</p>
            <label>
              Search or describe a diagnosis
              <input className="diagnosis-search" placeholder="e.g. chest tightness, medication reaction" />
            </label>
            <div className="form-grid">
              <label className="wide">
                Problem title <b>*</b>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Problem description" />
              </label>
              <label>
                Date identified <b>*</b>
                <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>
              <label>
                Severity
                <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                  <option>Mild</option>
                  <option>Moderate</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
              </label>
              <fieldset className="wide">
                <legend>Status</legend>
                {["Active", "Controlled", "Resolved"].map((status) => (
                  <label key={status}>
                    <input type="radio" name="status" checked={form.status === status} onChange={() => setForm({ ...form, status })} />
                    {status}
                  </label>
                ))}
              </fieldset>
              <label className="wide">
                Clinical synopsis <b>*</b>
                <textarea required value={form.synopsis} onChange={(e) => setForm({ ...form, synopsis: e.target.value })} placeholder="Symptoms, relevant context, observations, next steps" />
              </label>
              <label className="patient-visible wide">
                <input type="checkbox" checked={form.patientVisible} onChange={(e) => setForm({ ...form, patientVisible: e.target.checked })} />
                <span>
                  <b>Create a patient-facing summary</b>
                  <small>Visible approval is required. Unsupported content should abstain instead of releasing.</small>
                </span>
              </label>
            </div>
            <div className="editor-actions">
              <button type="button" className="discard" onClick={() => setEditorOpen(false)}>Discard</button>
              <button type="submit">{role === "staff" ? "Save staff note" : "Save structured update"}</button>
            </div>
          </form>
        </div>
      )}

      {toast && (
        <div className="toast" onClick={() => setToast("")}>
          {toast}
          <span>×</span>
        </div>
      )}
    </main>
  );
}
