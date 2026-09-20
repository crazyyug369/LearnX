BLUEPRINT V6.1 FINAL — READ-ONLY — NO IMPLEMENTATION PERFORMED

Corrections applied to V6: (1) all normalized entities fully defined; (2) curriculum_nodes column count corrected to exactly 8; (3) content_revision defined unambiguously; (4) provenance/license historical relationship explicit; (5) dataset_release_id mechanism clarified; (6) sources.license_type removed; (7) final consistency audit completed. No architecture redesigned. No files modified. No database changes. No BKT/auth/teacher/admin changes.

=============================================================================
A. FINAL CANONICAL ARCHITECTURE
=============================================================================
Official/verified sources (NCERT/CBSE textbooks, syllabi, teacher manuals, peer-reviewed research)
→ version-controlled LearnX canonical dataset (immutable JSON package; single dataset_release_id per package; no runtime queries against JSON)
→ validated import/seed (one-time ETL; reads dataset_release_id; writes to MySQL)
→ MySQL authoritative runtime database (curriculum_nodes, chapters, topics, learning_outcomes, competencies, prerequisite_relationship, misconception_database, provenance, sources, licenses, assessment_metadata, question_bank, student_progress, quiz_attempts)
→ LearnX APIs/services/UI (read from MySQL; AI grounded in MySQL)

=============================================================================
B. FINAL ENTITY/DATA MODEL (complete definitions)
=============================================================================

--- curriculum_nodes (extends existing) ---
Required: id(UUID), subject('mathematics'), grade, title, description, difficulty(1-5), estimated_time_min, runtime_status(EXISTING: locked/in_progress/mastered)
Optional/additive (all nullable): pub_status(draft/review/approved/published/deprecated/rejected), provenance_id(UUID FK provenance.id), license_id(UUID FK licenses.id), learning_outcomes_json(TEXT — legacy projection only), misconception_tags_json(TEXT — legacy projection only), prerequisites_json(JSON array — legacy projection only; NOT authoritative), tags(JSON array), chapter_id(UUID FK chapters.id), topic_id(UUID FK topics.id)
Authoritative: subject, grade, title, description, difficulty, estimated_time_min, prerequisites_json (when sourced). pub_status requires SME review before published.
AI-generated initial: description, tags, prerequisites_json. All must be validated before pub_status=published.

--- chapters (new) ---
Required: id(UUID), grade_id(FK), number, title. Optional: description, ncert_code. Authoritative: grade_id, number, title, ncert_code. AI initial: description.

--- topics (new) ---
Required: id(UUID), chapter_id(FK), title. Optional: description, ncert_section. Authoritative: chapter_id, title. AI initial: description.

--- learning_outcomes (normalized, authoritative) ---
Required: id(UUID), concept_id(FK curriculum_nodes.id), description, bloom_level(ENUM: Recall/Application/Analysis/other — semantic/cognitive classification; NOT mechanical verb mapping), ncert_code(nullable VARCHAR).
Optional: competency_id(FK competencies.id).
Relationships: belongs to concept (curriculum_nodes); many outcomes per concept; referenced by legacy learning_outcomes_json (projection, NOT authoritative).
Authoritative fields: id, concept_id, description, bloom_level, ncert_code.
AI role: AI may propose bloom_level; human SME must validate before publication. AI may NOT invent ncert_code.
Legacy projection: learning_outcomes_json in curriculum_nodes is a backward-compatibility projection synchronized from learning_outcomes; must never diverge; must never become source of truth.

--- competencies (normalized) ---
Required: id(UUID), title, description, framework(VARCHAR, e.g. 'NCERT 2023'), level(VARCHAR, e.g. 'Stage 3').
Optional: code(VARCHAR nullable).
Relationships: referenced by learning_outcomes.competency_id.
Authoritative: all required fields.

--- prerequisite_relationship (normalized, authoritative for prerequisite graph) ---
Required: id(UUID), concept_id(FK curriculum_nodes.id), prerequisite_concept_id(FK curriculum_nodes.id).
Constraints: unique(concept_id, prerequisite_concept_id). Both FKs reference curriculum_nodes.id.
Optional: strength(FLOAT 0-1), validation_notes(TEXT).
Relationships: directional prerequisite edges; many edges per concept allowed (as prerequisite or dependent).
Authoritative: concept_id, prerequisite_concept_id. These are the canonical prerequisite edges.
Legacy projection: prerequisites_json in curriculum_nodes is a backward-compatibility projection synchronized from prerequisite_relationship; must never diverge; must never become source of truth.
AI role: AI may suggest prerequisite candidates; SME must validate before edge is published. No automatic activation from AI.
Validation: prerequisite cycle detection is error; orphan (zero edges) is warning only (foundational/terminal/independent concepts are valid).

--- misconception_database (normalized, authoritative) ---
Required: id(UUID), concept_id(FK curriculum_nodes.id), description, incorrect_reasoning, correct_reasoning.
Optional: trigger_pattern(VARCHAR), remediation(VARCHAR), source(VARCHAR), confidence(FLOAT 0-1), validation_status(ENUM).
Relationships: belongs to concept; many misconceptions per concept.
Authoritative: id, concept_id, description, incorrect_reasoning, correct_reasoning.
AI role: AI may propose misconceptions; SME must validate source and confidence before publication.
Legacy projection: misconception_tags_json in curriculum_nodes is a backward-compatibility projection synchronized from misconception_database; must never diverge; must never become source of truth.

--- question_bank (extends existing) ---
Required: id(UUID), concept_id(FK curriculum_nodes.id), stem(TEXT), question_type(ENUM: MCQ/Numerical/ShortAnswer/ProblemSolving), bloom_level(ENUM), difficulty(1-5), assessment_role(ENUM: diagnostic/practice/assessment/other — default other).
Optional/additive: options_json(JSON array, required for MCQ; null/ignored otherwise), correct_index(INTEGER, required for MCQ; must be NULL/non-required for Numerical/ShortAnswer/ProblemSolving), answer_metadata(TEXT JSON, see below), explanation(TEXT), hint(TEXT), misconception_targets_json(JSON array of misconception IDs), provenance_id(UUID FK provenance.id — nullable), license_id(UUID FK licenses.id — nullable), difficulty_evidence(TEXT), pub_status(ENUM draft/review/approved/published/deprecated/rejected), dataset_release_id(VARCHAR — nullable, see F).
Answer representation by question_type (unambiguous):
  MCQ: options_json (array) + correct_index (integer, exactly one correct option required). correct_index is NOT used by other types.
  Numerical: answer_metadata = {"expected_value": <number>, "tolerance": <number|null>, "unit": "<string|null>"}. No correct_index.
  ShortAnswer: answer_metadata = {"reference_answer": "<string>", "rubric": "<string|null>"}. No correct_index.
  ProblemSolving: answer_metadata = {"reference_solution": "<string>", "key_reasoning": "<string|null>", "rubric": "<string|null>"}. No correct_index.
Legacy compatibility: existing MCQ rows (with options_json + correct_index) remain fully functional; new fields are nullable; no redesign of existing questions.

--- assessment_metadata (normalized) ---
Required: id(UUID), question_id(FK question_bank.id) OR diagnostic_item_id (nullable FK to a diagnostic item table — if needed in future), status(ENUM: draft/expert_reviewed/pilot/field_tested/validated).
Optional: discrimination_index(FLOAT nullable), difficulty_index(FLOAT nullable), reliability_coefficient(FLOAT nullable), validation_sample_size(INTEGER nullable), pub_status(ENUM: draft/review/approved/published/deprecated/rejected), field_test_date(DATE nullable), field_test_location(TEXT nullable), reviewer(VARCHAR nullable).
Relationships: belongs to a question (or future diagnostic item).
Psychometric rules: metrics are required ONLY when evidence exists; never fabricate. Most new questions start with null values and progress through status lifecycle.

--- ncert_bkt_priors (normalized, research-only) ---
Required: id(UUID), concept_id(FK curriculum_nodes.id), p_l0(FLOAT), p_transit(FLOAT), p_guess(FLOAT), p_slip(FLOAT), sample_size(INTEGER), data_source(VARCHAR).
Relationships: one-to-many with curriculum_nodes.id.
Status: research/metadata only. Does NOT alter live BKT behavior. Existing GLOBAL_BKT_DEFAULT and CALIBRATED_SKILL_PARAMETERS remain unchanged for all initial integration.
Authoritative use: provides calibrated priors for future statistical work; not used in runtime BKT during initial phases.

=============================================================================
C. FINAL CURRENT → FUTURE MAPPING
=============================================================================
ConceptNode interface → MIGRATE (extend curriculum_nodes; no new concepts table).
GRADE_CURRICULUM_DATA → MIGRATE (legacy only; not authoritative for new hierarchy).
INITIAL_CONCEPTS → MIGRATE (seed data; enriched with chapter/topic links).
GRADE_DIAGNOSTIC_QUESTIONS → TRANSFORM (maps to question_bank with question_type=actual format; assessment_role=diagnostic).
SAMPLE_QUESTIONS → TRANSFORM (maps to question_bank after enrichment).
curriculum_nodes (table) → KEEP (additive columns only: provenance_id, license_id, pub_status, JSON fields, chapter_id, topic_id; runtime_status preserved).
question_bank (table) → KEEP (additive columns only: question_type, bloom_level, assessment_role, answer_metadata, provenance_id, license_id, pub_status, dataset_release_id; existing rows unchanged).
student_progress → KEEP (current-state; additive nullable dataset_release_id + content_revision only; no event sourcing).
quiz_attempts → KEEP (historical interaction table preserved; additive nullable dataset_release_id + question_revision only).
ncert_curriculum_dag.json → TRANSFORM (research/input only; validated prerequisite edges go to prerequisite_relationship; not authoritative until SME-validated).
BKT parameters → KEEP (unchanged; ncert_bkt_priors is research-only).
=============================================================================
D. FINAL DATABASE STRATEGY
=============================================================================
Concept table: existing curriculum_nodes; exactly 8 additive columns: provenance_id, license_id, pub_status, learning_outcomes_json, misconception_tags_json, prerequisites_json, chapter_id, topic_id. runtime_status is preserved unchanged.
New normalized tables: chapters, topics, learning_outcomes, competencies, prerequisite_relationship, misconception_database, provenance, sources, licenses, assessment_metadata, ncert_bkt_priors.
Normalized authoritative sources: learning_outcomes (table) is authoritative; prerequisite_relationship (table) is authoritative; misconception_database (table) is authoritative.
Legacy backward-compatibility projections: learning_outcomes_json, prerequisites_json, misconception_tags_json in curriculum_nodes are projections synchronized from their normalized tables; must never diverge; must never become source of truth.
Polymorphic references (NO SQL FK on entity_id): provenance.entity_id and licenses.entity_id are polymorphic. Integrity is enforced by canonical JSON validation, ETL validation, and application/service-layer validation (verify entity_type matches actual table and entity_id matches UUID).
Migration risk: additive only; all new columns nullable; existing rows valid.
Backward compatibility: preserved. New fields ignored by legacy code until adopted.
=============================================================================
E. FINAL SOURCE/PROVENANCE/LICENSE STRATEGY
=============================================================================
Source registry (sources table): id(UUID), name, url, type(official_textbook/official_syllabus/research_paper/repository/website/other), version, accessed_date, verification_status(pending/verified/rejected). Pipeline requires verification_status=verified for publication of entities using that source.
Provenance (polymorphic, no SQL FK on entity_id): id(UUID), entity_type(VARCHAR: 'curriculum_nodes'/'question_bank'/'misconception_database'/other), entity_id(UUID), source_id(FK sources.id), accessed_date, content_revision(VARCHAR), source_version(VARCHAR nullable), retrieval_method(VARCHAR nullable), access_notes(TEXT nullable). Multiple provenance records per entity allowed (revisions, different sources). Historical provenance rows are retained and immutable.
Content revision definition: an immutable deterministic string identifying the exact revision of a canonical entity within a dataset release. Example format: "v1.0.0:curriculum-node:math-001:r3". Not a Git SHA (optional); not an integer alone. Provenance records reference this exact revision.
License (polymorphic, no SQL FK on entity_id): id(UUID), entity_type(VARCHAR), entity_id(UUID), license_type(VARCHAR), license_url(VARCHAR), attribution_text(TEXT nullable), copyright_holder(VARCHAR nullable), restrictions(TEXT nullable), verification_status(pending/verified/rejected). Multiple license records per entity allowed (revisions, derived works). Pipeline requires verification_status=verified.
External content: requires verified reuse rights; license record must match source terms; provenance links to verified source.
LearnX-authored original content: provenance points to authoritative source(s) for factual/curriculum grounding; applicable license is determined by legal review (LearnX Proprietary, CC BY, or research-only if unclear); does NOT automatically inherit source license.
No reference to undefined "sources.license_type"; source identity and verification live in sources.table; license terms live in licenses.table.
=============================================================================
F. FINAL VERSIONING AND HISTORICAL REPRODUCIBILITY STRATEGY
=============================================================================
Version layers (all preserved): academic_year | curriculum_version (semver) | dataset_release_id (canonical JSON package identifier) | source_version | content_revision (deterministic string of entity within dataset release).
Dataset release mechanism: canonical JSON package carries exactly one dataset_release_id (e.g., "v1.0.0"). The ETL/import batch records this identifier. It is NOT a database table; it is an immutable release identifier. No extra database table needed.
student_progress (current-state only): additive nullable dataset_release_id(VARCHAR) and content_revision(VARCHAR). These capture the dataset release and content revision(s) associated with the current mastery state. Not an event log; not event sourcing.
quiz_attempts (historical interaction table preserved): existing structure unchanged; additive nullable dataset_release_id(VARCHAR) and question_revision(VARCHAR). These identify the dataset release and the specific question revision encountered during the attempt. Existing rows may have NULL for these new fields.
Historical reproducibility: a student interaction is reproducible by checking dataset_release_id + content_revision (for mastery) or dataset_release_id + question_revision (for quiz attempts). This is the minimum safe mechanism; no event sourcing; no unnecessary history architecture.
=============================================================================
G. FINAL VALIDATION STRATEGY
=============================================================================
Automatic (CI/merge-blocking): schema validation, duplicate ID detection, broken FK references (excluding polymorphic provenance/licenses), prerequisite cycle detection (error), orphan prerequisite detection (warning only), provenance verification (pub_status=published requires source verification_status=verified), license verification (pub_status=published requires license verification_status=verified), learning outcome linkage (published concept has ≥1 linked outcome; warning if none), concept linkage (questions reference valid concepts), misconception linkage (misconceptions reference valid concepts), assessment_role validity (must be one of defined ENUM values), legacy JSON sync check (learning_outcomes_json/prerequisites_json/misconception_tags_json must match normalized tables; divergence is error), dataset_release consistency (version references must be valid), source/version consistency, content_revision format consistency.
Human expert: curriculum SME (hierarchy, definitions, difficulty, time, NCERT alignment); prerequisite SME (edge soundness, no cycles); question SME (semantic completeness per question_type, Bloom classification, distractors); misconception SME (source, confidence); Bloom validation (semantic/cognitive, not verb-based); psychometric validation (metrics only with evidence; never fabricated).
Legal/license: counsel verifies sources.license_type matches actual source terms; attribution requirements met; AI-generated content license justified; licenses.verification_status=verified before publication.
=============================================================================
H. FINAL MIGRATION/INTEGRATION STRATEGY
=============================================================================
Phase 0 — Dataset contract/schema (DDL, JSON Schemas; no data import).
Phase 1 — Source/provenance/license registry (sources, licenses, provenance tables; verified sources loaded).
Phase 2 — Build canonical Mathematics dataset (JSON only; no MySQL load).
Phase 3 — Learning outcomes + prerequisite + misconception layer (JSON only).
Phase 4 — Assessment/questions (enhance question_bank; add assessment_role; populate answer_metadata per question_type; JSON only).
Phase 5 — Automatic validation + human SME validation + legal/license validation (JSON dataset approved before import).
Phase 6 — Import APPROVED canonical dataset into MySQL (ETL writes approved JSON to extended tables; synchronizes legacy JSON projections; records dataset_release_id).
Phase 7 — Existing LearnX APIs/adaptive-engine integration (read from MySQL; no API contract changes).
Phase 8 — AI grounding (prompts pull canonical facts from MySQL; source citation enforced).
Phase 9 — Later BKT calibration research (ncert_bkt_priors table; data collection; statistical validation; no live BKT change).
Rollback at any point: stop new ETL; existing MySQL remains fully functional (additive schema, no destructive changes).
=============================================================================
I. FINAL ORDERED IMPLEMENTATION PHASES
=============================================================================
Phase 0: Schema definition — JSON Schemas, MySQL DDL (CREATE TABLE, ADD COLUMN). Zero data load.
Phase 1: Registry — sources (with verification_status), licenses (with verification_status), provenance tables; populate verified sources.
Phase 2: Canonical dataset — grade→chapter→topic→concept JSON built from verified sources.
Phase 3: Outcomes/prerequisites/misconceptions — populate learning_outcomes, competencies, prerequisite_relationship, misconception_database (JSON only, SME-reviewed).
Phase 4: Questions — enhance question_bank; set assessment_role; populate answer_metadata; ensure correct_index only for MCQ; no redesign of existing questions.
Phase 5: Validation + approval — automatic pipeline passes; SME reviews complete; legal/license verification_status=verified; legacy JSON projections synchronized; dataset approved.
Phase 6: Import approved dataset — ETL writes approved dataset to MySQL; sets dataset_release_id on import batch; synchronizes legacy JSON fields; leaves existing rows intact.
Phase 7: API/adaptive integration — services read from extended MySQL; adaptive engine uses prerequisite_relationship (fallback to prerequisites_json); no contract changes.
Phase 8: AI grounding — AI prompts reference canonical MySQL data; outputs cite sources; no new endpoint modifications.
Phase 9: BKT research — ncert_bkt_priors table; data collection; future statistical calibration only; no change to GLOBAL_BKT_DEFAULT or CALIBRATED_SKILL_PARAMETERS.
=============================================================================
J. FINAL HUMAN/RESEARCH/LEGAL APPROVAL GATES
=============================================================================
License/legal review (before external source publication): confirm reuse rights; verify sources.verification_status=verified; verify licenses.verification_status=verified.
Curriculum SME review (before pub_status=published): hierarchy, definitions, difficulty, time, NCERT alignment.
Prerequisite SME review (before edge activation): pedagogical soundness; no cycles; zero-edge concepts evaluated individually (warning only).
Question SME review (before pub_status=published): semantic completeness per question_type; Bloom classification validated; distractors plausible; answer representation correct.
Bloom classification: AI may propose; human expert must approve; must be cognitive/semantic, not verb-mapped.
Psychometric evidence: metrics only when field-test evidence exists; never fabricated; status progresses only with evidence.
AI/prompt review: review samples for hallucination, bias, unverified claims; enforce source citation.
Source/license verification: pipeline requires verification_status=verified for both sources and licenses before entity reaches pub_status=published.
=============================================================================
K. EXPLICIT DECISIONS THAT STILL REQUIRE OUR APPROVAL
=============================================================================
1. Exact initial source editions (which NCERT/CBSS editions, versions, URLs; which research papers; access dates).
2. Final JSON schema details (exact file structure, entity IDs, naming conventions, dataset_release_id format — e.g., "v1.0.0" or "v1.0.0-2025-26").
3. Legal approval workflow for LearnX-authored AI-assisted content (how to determine applicable license after transformation; what level of original expression is sufficient for LearnX Proprietary claim).
4. Exact dataset_release_id format (whether to include academic year; whether to use compound identifier).
5. Enrichment/migration strategy for existing question_bank rows (batch update of answer_metadata per inferred question_type vs. incremental flagging; how to handle legacy MCQ rows that lack new fields).
6. Threshold for warning vs. error in validation pipeline (e.g., how many missing learning outcomes trigger a block; whether orphan prerequisite edges always allow publication or require manual override).
7. Any decision regarding the timing and scope of Phase 9 BKT calibration (when to begin data collection; what statistical methodology to apply; how to link ncert_bkt_priors to live calculations once evidence exists).
=============================================================================
L. FINAL COMPATIBILITY/RISK CHECKLIST
=============================================================================
student_progress: preserved as current-state table; additive nullable dataset_release_id and content_revision columns only; no event sourcing; no replacement history system.
quiz_attempts: preserved as existing historical interaction table; existing structure unchanged; additive nullable dataset_release_id and question_revision columns only; no other changes.
mastery history: unchanged; BKT formula unchanged; BKT parameters unchanged; ncert_bkt_priors does not affect live BKT.
authentication: untouched.
teacher functionality: untouched; reads from MySQL.
admin functionality: untouched.
MySQL runtime authority: confirmed; JSON dataset is immutable version-controlled source; runtime never reads JSON directly.
existing NCERT DAG: treated as research/input only; prerequisite_relationship is authoritative; validated edges only.
normalized sources of truth:
  learning_outcomes (table) authoritative; learning_outcomes_json (projection only, synchronized, never source of truth).
  prerequisite_relationship (table) authoritative; prerequisites_json (projection only, synchronized, never source of truth).
  misconception_database (table) authoritative; misconception_tags_json (projection only, synchronized, never source of truth).
legacy JSON projections: must remain synchronized during ETL; must never diverge; application code must not edit them independently.
polymorphic integrity: provenance.entity_id and licenses.entity_id have NO SQL FK; integrity enforced by validation (JSON, ETL, application/service layer) confirming entity_type matches actual table and entity_id exists.
content_revision: defined unambiguously as deterministic string (e.g., "v1.0.0:curriculum-node:math-001:r3"); not integer alone; not Git SHA exclusively; referenced by provenance records.
dataset_release_id: defined as immutable identifier of canonical JSON package release; no extra database table needed; stored in interaction tables (student_progress, quiz_attempts) to capture interaction-time release.
provenance/license historical preservation: multiple provenance/license records per entity allowed; historical records retained; current record referenced by nullable FK; deprecated/rejected entities keep records.
assessment_role: ENUM (diagnostic/practice/assessment/other); diagnostic questions use actual question_type (MCQ/Numerical/ShortAnswer/ProblemSolving) plus assessment_role=diagnostic; not a replacement answer model.
question answer model: MCQ uses options_json + correct_index; Numerical uses answer_metadata.expected_value; ShortAnswer uses answer_metadata.reference_answer; ProblemSolving uses answer_metadata.reference_solution; no universal correct_index requirement.
question_bank backward compatibility: existing rows untouched; new fields nullable; legacy logic continues to work.
license/provenance verification: both sources.verification_status and licenses.verification_status must be verified before pub_status=published.
no new architecture added: only the six corrections (entity definitions, column count, content_revision, historical provenance/license, dataset_release_id, legacy JSON non-authoritative status) incorporated; no redesign; no new phases; no BKT change; no auth/teacher/admin change.
=============================================================================
BLUEPRINT V6.1 FINAL — READ-ONLY — NO IMPLEMENTATION PERFORMED
=============================================================================