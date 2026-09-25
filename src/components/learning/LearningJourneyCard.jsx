import React, { useMemo } from "react";
import "./LearningJourneyCard.css";

const safe = (value) => (value == null ? "" : String(value).trim());

const toList = (value) => {
  if (Array.isArray(value)) return value.map((x) => safe(x)).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(/\r?\n|;/g)
    .map((x) => x.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
};

const normalizeJourney = (raw) => {
  let source = raw;
  if (typeof source === "string") {
    try { source = JSON.parse(source); } catch { source = null; }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;

  const stages = Array.isArray(source.stages)
    ? source.stages
        .map((stage, index) => ({
          key: safe(stage?.key) || `stage-${index + 1}`,
          title: safe(stage?.title) || `Step ${index + 1}`,
          description: safe(stage?.description || stage?.detail),
          duration: safe(stage?.duration),
          icon: safe(stage?.icon),
        }))
        .filter((stage) => stage.title || stage.description)
    : [];

  return {
    title: safe(source.title) || "Today's Learning Journey",
    mission: safe(source.mission || source.summary),
    beforeClass: toList(source.beforeClass || source.before_class),
    warmupQuestions: toList(source.warmupQuestions || source.warmup_questions),
    stages,
    keyTakeaways: toList(source.keyTakeaways || source.key_takeaways),
    outcome: safe(source.outcome || source.learningOutcome || source.learning_outcome),
    note: safe(source.note || source.studentNote || source.student_note),
    _sourceMaterial:
      source._sourceMaterial && typeof source._sourceMaterial === "object"
        ? source._sourceMaterial
        : source.sourceMaterial && typeof source.sourceMaterial === "object"
          ? source.sourceMaterial
          : source.source_material && typeof source.source_material === "object"
            ? source.source_material
            : null, // PATCH_REUSE_LESSON_SOURCE_META
  };
};

const resolveLogo = (institution) => {
  const raw = institution?.logo || institution?.logo_url || institution?.school_logo || "";
  if (!raw) return "";
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  const base = String(process.env.REACT_APP_API_URL || window.location.origin || "").replace(/\/+$/, "");
  return base ? `${base}/${String(raw).replace(/^\/+/, "")}` : raw;
};

const iconForStage = (stage, index) => {
  const key = `${stage?.key || ""} ${stage?.title || ""}`.toLowerCase();
  if (stage?.icon?.startsWith("bi-")) return stage.icon;
  if (/warm|ready|recap/.test(key)) return "bi-lightning-charge";
  if (/discover|explore/.test(key)) return "bi-compass";
  if (/learn|understand|concept/.test(key)) return "bi-lightbulb";
  if (/practice|worksheet|try/.test(key)) return "bi-pencil-square";
  if (/challenge|apply/.test(key)) return "bi-stars";
  if (/check|assess|exit|quiz/.test(key)) return "bi-check2-circle";
  if (/complete|reflect|wrap/.test(key)) return "bi-flag";
  return ["bi-1-circle", "bi-2-circle", "bi-3-circle", "bi-4-circle", "bi-5-circle", "bi-6-circle"][index] || "bi-circle";
};

export default function LearningJourneyCard({
  journey,
  institution,
  branchName = "",
  className = "",
  subjectName = "",
  topic = "",
  teacherName = "",
  weekRange = "",
  printable = false,
  actions = null,
}) {
  const normalized = useMemo(() => normalizeJourney(journey), [journey]);
  const logo = useMemo(() => resolveLogo(institution), [institution]);
  if (!normalized) return null;

  const institutionName = safe(institution?.name || institution?.school_name) || "Your Institution";

  return (
    <section className={`learning-journey ${printable ? "learning-journey--printable" : ""}`}>
      <header className="learning-journey__brand">
        <div className="learning-journey__identity">
          <div className="learning-journey__logo-wrap">
            {logo ? <img src={logo} alt={`${institutionName} logo`} /> : <i className="bi bi-mortarboard" />}
          </div>
          <div>
            <div className="learning-journey__institution">{institutionName}</div>
            {branchName ? <div className="learning-journey__branch">{branchName}</div> : null}
          </div>
        </div>
        <div className="learning-journey__brand-tag">
          <i className="bi bi-map" /> Learning Journey
        </div>
      </header>

      <div className="learning-journey__hero">
        <div>
          <span className="learning-journey__eyebrow">Before-class roadmap</span>
          <h2>{normalized.title}</h2>
          <p>{normalized.mission || `Get ready to learn ${topic || "today's lesson"}.`}</p>
        </div>
        <div className="learning-journey__meta">
          {className ? <span><i className="bi bi-people" /> {className}</span> : null}
          {subjectName ? <span><i className="bi bi-book" /> {subjectName}</span> : null}
          {topic ? <span><i className="bi bi-bullseye" /> {topic}</span> : null}
          {weekRange ? <span><i className="bi bi-calendar3" /> {weekRange}</span> : null}
          {teacherName ? <span><i className="bi bi-person-badge" /> {teacherName}</span> : null}
        </div>
      </div>

      {(normalized.beforeClass.length || normalized.warmupQuestions.length) ? (
        <div className="learning-journey__prep-grid">
          {normalized.beforeClass.length ? (
            <div className="learning-journey__prep-card">
              <div className="learning-journey__section-title"><i className="bi bi-backpack2" /> Before You Arrive</div>
              <ul>{normalized.beforeClass.map((item, index) => <li key={`before-${index}`}>{item}</li>)}</ul>
            </div>
          ) : null}
          {normalized.warmupQuestions.length ? (
            <div className="learning-journey__prep-card">
              <div className="learning-journey__section-title"><i className="bi bi-chat-square-question" /> Warm-up</div>
              <ol>{normalized.warmupQuestions.map((item, index) => <li key={`warm-${index}`}>{item}</li>)}</ol>
            </div>
          ) : null}
        </div>
      ) : null}

      {normalized.stages.length ? (
        <div className="learning-journey__path" aria-label="Lesson roadmap">
          {normalized.stages.map((stage, index) => (
            <React.Fragment key={`${stage.key}-${index}`}>
              <div className="learning-journey__stage">
                <div className="learning-journey__stage-icon"><i className={`bi ${iconForStage(stage, index)}`} /></div>
                <div className="learning-journey__stage-copy">
                  <div className="learning-journey__stage-head">
                    <strong>{stage.title}</strong>
                    {stage.duration ? <span>{stage.duration}</span> : null}
                  </div>
                  {stage.description ? <p>{stage.description}</p> : null}
                </div>
              </div>
              {index < normalized.stages.length - 1 ? <div className="learning-journey__connector" aria-hidden="true"><i className="bi bi-arrow-down" /></div> : null}
            </React.Fragment>
          ))}
        </div>
      ) : null}

      <div className="learning-journey__finish-grid">
        {normalized.keyTakeaways.length ? (
          <div className="learning-journey__takeaways">
            <div className="learning-journey__section-title"><i className="bi bi-stars" /> Today's Key Takeaways</div>
            <div className="learning-journey__chips">
              {normalized.keyTakeaways.map((item, index) => <span key={`takeaway-${index}`}>{item}</span>)}
            </div>
          </div>
        ) : null}
        {normalized.outcome ? (
          <div className="learning-journey__outcome">
            <div className="learning-journey__section-title"><i className="bi bi-flag-fill" /> Mission Complete</div>
            <p><strong>By the end of this lesson, I can:</strong> {normalized.outcome}</p>
          </div>
        ) : null}
      </div>

      {normalized.note ? <div className="learning-journey__note"><i className="bi bi-info-circle" /> {normalized.note}</div> : null}
      {actions ? <div className="learning-journey__actions">{actions}</div> : null}

      <footer className="learning-journey__footer">
        <span>{institutionName}{branchName ? ` · ${branchName}` : ""}</span>
        <span>Learning with purpose</span>
      </footer>
    </section>
  );
}

export { normalizeJourney };
