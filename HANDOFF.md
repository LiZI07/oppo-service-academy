# OPPO Service Academy — team rollout
GitHub source export of the private training application. Vinext + D1 DB + private R2 BUCKET. See README.md and DEPLOYMENT.md for the export-specific authentication guard, administrator configuration and deployment requirements. Keep this repository private.

## Seven real roles
A fresh database can bootstrap an Admin only from BOOTSTRAP_ADMIN_EMAIL after trusted authentication. This export removes the original personal email and automatic role-promotion migration. Roles: trainee, trainer, store_manager, regional_supervisor, leader, vpc, admin. Role names are VN/CN/EN in policy.mjs.
- Trainer: only directly assigned trainees (members.trainer).
- Store manager: explicit store/individual-trainee scope in rights documents. May review daily practice/course outcomes where trainerAssess allows it, and finalize week1 only with an explicit checkpoint grant.
- Regional supervisor: explicit store/individual-trainee scope. Reads records and prepares remedial follow-up; may finalize month1/kpi30/kpi45 only with explicit grants. Does not approve daily journals or technical certifications.
- VPC: existing per-course/stage rules plus optional explicit learner scope. New UI defaults to selected stores/trainees. For backward compatibility only, legacy VPC rights without a scope retain prior all-trainee eligibility limited by course/stage authority; scope.mode=all explicitly represents that in the UI.
- Leader: explicit store/trainee scope, shared final results and optional eligibility for individually assigned checkpoints.
- Admin: account, role, scope, course ACL and examiner assignment management; cannot write exam scores without being the assigned examiner. Cannot disable/demote own active admin profile. Linked emails cannot be changed to transfer an identity.
- Trainee: own learning, evidence and results; notes remain personal even against Admin.
App account creation never sends platform invitations or changes Site sharing. Owner must grant Site viewer access separately using exact employee emails. Do not guess people or accounts from source names.

## Scoped permissions
Separate documents kind courseAcl, ID acl:<course>, store VPC grants (edit/upload/publish/assess/note/sourceKey), plus trainerAssess for assigned trainers. These cannot be changed by a course editor. Rights documents rights:<member> grant official stages week1/month1/lv1/practical/kpi30/kpi45/kpi90/follow90 and optional new-course creation. Server enforces role, learner scope, course scope and stage scope for reads/writes/file downloads.
Editors lacking publish authority submit revisions to courseDraft for approval; live published content remains unchanged. Draft approval checks the base revision. Published questions require publisher authority to change; nonpublishers may author draft questions.

## Source-based content
All three attachments were read in depth. Also inspected the embedded flowchart in Word, now in public/training-process-source.png behind the private Site. Plan page includes purpose/scope, responsibilities, named source directory, delivery/resources, results handling, trainer eligibility (first4 mandatory), selection flow and required records.
26 curriculum modules include theory, traineeTasks, trainerTasks, resources, evidence, exact source excerpts, quantity scope (stage/daily/distinct models), responsibleKeys and assessment notes. Source directory: Quốc Vĩ, Hiếu, A Yun, Nino, Thuận/顺哥, Long, store manager, regional supervisor, technical team. Do not infer real login emails from names.
Latest user thresholds override old source: LV1>=90; practical strictly>90 out of100, 20 criteria x5; group maxima15/25/25/15/20. Latest day90 checkpoint takes precedence over Word diagram's post-confirmation30-day note; both are documented, no extra assessment auto-created. The diagram's personnel outcome is a source reference, never an automatic employment action.
Task schedule follows detailed Appendix01 Excel. Foldable scope, daily reception targets and TAT/order-rate semantics retain source differences/explicit confirmation requirements. No invented full technical lectures or O-ELITE/GCSM sync.

## Features
Private notes; dated journals, models/counts, photos or video/audio links; trainer review/return/resubmission history; separate course-completion reviews with four clearly labeled app-support checks; official assessment drafts/finals with evidence/history; KPI days30/45/90; course-scoped remedial/retest plans; course-specific server-graded practice quizzes; multilingual course/question management; CSV reports and audit trail.
Learning files: upload multiple PDF/Word/Excel/PPT/images/MP4-WebM/MP3-WAV/TXT-CSV up to20MiB each. Evidence images max5MiB. MIME signatures checked; document downloads are attachments. File rename preserves extension. File/course removal is recoverable archive, with reason and history, retaining learner records and R2 objects. Course restoration is draft until published.

## Validation
node node_modules/typescript/bin/tsc --noEmit
node tests/training.test.mjs
Integration suite uses actual SQL schema and actual server handlers with mocked trusted platform identity, testing 4roles, scope and revocation, checkpoint grants, private notes/files, review field tampering, server quiz, 90/91 boundaries, incomplete drafts, KPI unknown-rule handling, course revisions/conflicts, nonpublisher draft approval, material uploads/scope/remove/restore, course archive/restore and retained history, cross-origin rejection, inactive accounts.
Browser QA read-only preview: distinct Admin/VPC/Trainer dashboards, no Accounts menu for VPC, course responsibility/grant panels, enriched trilingual content form, file/course lifecycle panels, all nine plan sections and original Word image loaded. No actual staff sign-in, phone camera hardware or mobile-device verification. Do not claim these passed.

## Deployment and operations
pnpm dev
The original release used managed Sites hosting. This export is not automatically connected to that release. See DEPLOYMENT.md before configuring another host. No schema change from v2; v3 seed enriches existing course documents and initializes empty per-course ACLs without overwriting edited body/title. It is idempotent and batched. Platform Site sharing remains separate from app profiles and unchanged. No invitations/messages are sent by account creation. No real database rows, employee evidence or private uploaded learning files are included in this source export.

## Account/session discoverability update
Added /login with trilingual native ChatGPT sign-in/session status, /api/session to distinguish platform identity from app membership, visible header sign-out anchor, account dropdown, My account page and pinned Admin account-management shortcut. All sign-in/out actions are top-level anchors to Sites-owned reserved routes; no local password/session stack or credential reset is implemented. A private Site may show the platform gate immediately after sign-out before /login can render. Preview explicitly disables real sign-out and links to the live app.
Account list adds search, role filtering and sign-in-linked/pending badges. No invitations are sent.
Validation added tests/auth-ui.test.mjs (native paths, Admin visibility, trainer restrictions, preview, profile) and session-route integration checks (anonymous, signed-in unassigned, owner Admin). Browser checked dropdown, Admin management access and anonymous /login; did not perform real sign-in/out or disrupt the user's session.


## Academy UX update
- Reference reviewed: user-supplied Claude HTML; reused task-first learning/practice/review concept, retained authenticated D1/R2 workflows.
- Role-specific actionable workbench, next trainee checkpoint, searchable/filterable course card library, journal status queues sorted by update.
- Opening practice from a lesson preselects that module. Roadmap day selector lists every overlapping module instead of silently opening the first.
- Updated responsive OPPO green workspace theme; VN/CN/EN, real per-account permissions and native sign-in/out retained.
- Platform audience remains owner-private; this update does not grant employees Site access.

## Team operations implementation
- app/lib/team.ts aggregates only authorized operational records, excluding personal notes. Team stats cover active trainees; each row has program day, completed/total, percentage, reviewed outcomes, last/next module, overdue counts, pending/returned journals and active minutes. VPC totals are restricted to assessable courses, with no global timer access.
- app/team-view.tsx is the staff home; search/store/status filters, pagination, refresh and safe CSV export. Scoped roster links open the correct individual results/journal. Separate profiles are fetched server-side; no client-only role simulation in the real app.
- AccountsCenter groups personal account/session, people and Rights & Scope tabs. Removed duplicate My Account navigation, account shortcuts and pilot banners. Reference navigation is collapsed. Admin rollout page replaces a public demo link.
- CSV creates 1–50 new profiles atomically after full validation; no existing profile overwrite, no invitation and no automatic manager scope. trainer_email can refer to an existing trainer or one in the same batch. Template and preview are available in Accounts.
- /api/operations is Admin-only and reports DB read/bucket binding status, missing trainee setup, manager scope, materials/course owners and checkpoint assessors. It is not proof of file round-trip, staff sign-in, backup readiness or load acceptance.
- /preview contains separate fictional six-role scenarios, multi-trainee progress and distinct store/region scopes. No sample accounts are inserted into the production DB.
- No schema changes. Existing documents carry scope {mode:assigned|all,stores:[],trainees:[]}. All new scope/role writes use existing audited revision checks.

## Rollout acceptance still needed
Provide exact real names/emails, roles, store/regional mapping, trainee hire dates and trainers; configure Site viewer allowlist without making the Site public. Upload and approve real lectures/question banks; reconcile source rules. Run one real store workflow using separate staff accounts and test phone uploads. Establish an IT operator, DB/file backup+restore process and retention, and load-test expected team scale before organization-wide rollout. Sign-in remains ChatGPT; no company SSO/password service. Custom domains are supported by Sites once the company provides its hostname and DNS configuration.

Validation expanded: SQL-backed route suite covers six roles, default-deny manager scope, scoped team percentages, course-only VPC progress, out-of-scope files/records, immediate revocation, official checkpoint role limits, health authorization, atomic batch import and linked first sign-in. UI tests cover consolidated account entry, six-role profiles and native sign-in/out. Browser checks use fictional read-only previews, not production staff identity.

## Latest assessment ownership and publication rules (authoritative)
- Official assessments and KPI checkpoints use documents kind examAssignment, ID exam:<trainee>:<stage>. One assessorId per trainee and checkpoint, optional due date, rationale and audited revision history. Admin alone assigns/reassigns/revokes. Candidates must be active, non-trainee, have scope over the learner and checkpoint eligibility. Global rights.stages now indicates eligibility, not unilateral grading authority.
- Every assessment/KPI draft, final and amendment requires the signed-in member to match that exact assignment. No Admin override. Requests include assignmentRevision. D1 writes atomically check assignment ID, revision and assessorId within the score write, preventing a previously authorized save after reassignment.
- Final assessment/KPI results are readable to all related scoped actors: trainee self, assigned trainer, scoped store manager, regional supervisor, VPC and Leader, plus Admin. VPC no longer needs write authority for that exam to see its final score. Drafts are visible only to the current assigned assessor and Admin; draft history is removed from published records returned to other viewers. Existing final records remain readable; legacy exam edits require an explicit new assignment.
- Published results remain published. Amendments require final status and a reason; no final-to-draft downgrades. Score thresholds remain LV1>=90 and practical>90 with20x5/100.
- In-app result feed (latest50 published result revisions) is calculated from current scope. Each user has private resultRead receipts (latest100 keys). Header bell, personal unread state, and60-second/focus refresh; no email/SMS/push delivery or external messaging.
- New exam UI shows assignment, due date, Can assess/View only, Admin assignment editor, checkpoint navigation, premium results cards and group rubric bars. Updated team hero and precise SVG rings; decorative charts removed. Preview includes fictional Leader, individual assignments and shared published results; never seeds real account data.
- Operational setup reports missing individual exam assignments in addition to account/course gaps. Existing Site audience stays owner-private.
- Expanded integration suite verifies shared final visibility across all specified roles, non-assignee draft privacy/history redaction, unassigned Admin denial, assignment-revision checks, atomic reassignment guard and audit integrity, retained final results after revocation and per-user read receipts. Browser QA uses read-only sample identities. Real employee sign-in and phone hardware remain unverified.
