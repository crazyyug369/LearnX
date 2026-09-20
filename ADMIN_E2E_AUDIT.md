# ADMIN E2E & SECURITY BLACK-BOX AUDIT 

## A. Overview & Intent
This document logs the outcomes of an intensive **Read-Only / Black-Box Audit** investigating the LearnX Admin experience. As explicitly dictated, this audit acts strictly as a test-coverage and API verification assessment. **No production code, database schemas, or synthetic data records were created or modified.** The focus is mapping the current integration ecosystem to evaluate Playwright (E2E) viability and confirm Role-Based Access Control (RBAC) stability.

---

## B. Admin UI Inventory (Visual & Functional Coverage)
The `src/components/admin/AdminDashboard.tsx` acts as the definitive SuperAdmin console. It is gated to `isAdmin` evaluating to true within `App.tsx`. The interface is functionally mature, exposing seven primary toolsets:
1. **Overview (Analytics):** Renders high-level KPIs (`activeUsers`, `weeklyActive`, `averageMastery`) via local state arrays.
2. **Users Registry:** Interfaces full CRUD capability over users. Features non-stubbed `<form>` fields to create users and destructive action models for `Delete` and `Suspend`.
3. **Institutions Management:** Separate directory explicitly mapping B2B/School clients via unique DB IDs.
4. **AI Subsystem Interface:** Live input/output console targeting the Gemini engine directly (`test-gemini`), used for latency and reliability diagnostics safely isolated from student models.
5. **Global Content:** Houses extreme global-destructive UI actions (Nuke Database, Recompute Mastery, Backup).
6. **Platform Settings:** Interfaces toggles for enabling/disabling Global UI features.
7. **Audit Logs:** Standardizing accountability trails rendering real `sysadmin` footprints.

---

## C. API Contracts & Verification (`/api/admin/*`)
Server gateways in `server.ts` effectively export and fulfill UI demands exactly matched to `AdminDashboard.tsx` expectations.
- **Key Real Endpoints Contractual Match:**
  - `GET /api/admin/stats` ➔ Proxies to `getAdminKpis()`.
  - `GET /api/admin/users` ➔ Proxies to `getAdminUsers()`.
  - `POST /api/admin/users` ➔ Proxies to `adminCreateUser()`.
  - `DELETE /api/admin/users/:id` ➔ Proxies to `adminDeleteUser()` (safely cascades row deletions across `quiz_attempts`, `student_progress`, `cohort_students`, and `users` tables, removing artifact leaks).
  - `DELETE /api/admin/institutions/:id` ➔ Unlinks related users globally via SQL `NULL` fallbacks before destroying core records.
- **Stubbed Demo Endpoints:**
  - High-risk actions like `PATCH /api/admin/users/:id/suspend` and `POST /api/admin/nuke-database` return explicitly stubbed success payloads (e.g. `{ success: true, message: 'User suspended' }`) to satisfy demo interfaces without accidentally bricking production MySQL deployments.

---

## D. Security & RBAC Guardrails
- **Backend Gate (`server.ts`):** All traffic targeting `/api/admin/*` is forcibly passed through strict middleware gates: `app.use('/api/admin', verifyToken, requireRole(['admin']))`.
- **Ejection Tests (`tests/admin.test.ts`):** 
  Verified 5 distinct automated API Unit security matrix checks pass seamlessly:
  - Unauthorized Token ➔ 401 Rejection (Blocked)
  - Authorized Student ➔ 403 Rejection (Blocked)
  - Authorized Teacher ➔ 403 Rejection (Blocked)
  - Authorized Institution ➔ 403 Rejection (Blocked)
  - Authorized Admin ➔ 200 Execution (Successful)
- **Frontend Bounce Validation:** Manually tampering `sessionStorage` or attempting to hard-route the frontend client to `/admin` without validated DB metadata triggers an immediate `App.tsx` bounce context. No visual DOM leaks occur before rejection.

---

## E. Frontend Integrity (Component State Safety)
Evaluated explicit execution paths inside `AdminDashboard.tsx` targeting destructive queries (e.g. `handleDeleteUser`):
```ts
const res = await fetch(`/api/admin/users/${deleteConfirmUser.id}`, { method: 'DELETE' /*...*/ });
if (!res.ok) throw new Error('API Request Failed');
```
**Conclusion:** The Admin console faithfully executes modern defensive fetching. It invokes soft-confirm boolean states (`deleteConfirmUser`), safely catches `!res.ok` into localized Toast boundaries, and surgically re-fetches UI data `fetchUsers()` over successful queries instead of risking stale application cache.

---

## F. E2E Test Feasibility (Playwright Automation Viability)
- **Can an Admin E2E test be synthesized cleanly without bleeding into production?** **YES.**
- **Auth Trigger Available:** The standard DOM Login component (`AuthModal.tsx`) inherently exposes `<button id="tab-auth-admin">`. Playwright can natively orchestrate automated admin logins using exact replica patterns found in existing E2E strategies.
- **Data Isolation:** `tests/e2e/teacher.spec.ts` safely overrides env variables to connect to `learnx_e2e_test` before doing sweeping SQL truncations (`DELETE FROM users`). Establishing an `admin.spec.ts` mirroring this architecture would allow completely isolated real-database validations (e.g. asserting an admin can definitively delete a student logic row).

---

## G. Known Missing Tests & Coverage Holes (The Gap)
While backend access controls explicitly pass Unit tests, **the E2E Black-Box pipeline yields exactly 0% coverage for the Admin module.**
1. Submitting the `<form>` to create a new user/institution is historically unchecked dynamically.
2. UI rendering of large backend DB pagination (Audit Logs) is unmonitored for container breakage.
3. Stubbed API interactions (`nuke-database`) are not simulated at the Playwright intercept level to verify Toast success displays under edge testing.

---

## H. Architecture Integrity Check
**System Confirmed Clean:** Pursuant strictly to the mission brief:
- The `registerStudentInCohort()` functionality ("Bug C") in `App.tsx` remained perfectly untouched and quarantined.
- No DB scripts were maliciously triggered.
- No unauthorized payloads polluted active MySQL development spaces.

---

## I. Conclusion & Recommendations
**Verdict:** The LearnX Admin UI is mature, structurally rigorous, and demonstrably secured via functional backend `requireRole` implementations. The underlying HTTP endpoints cascade deeply and cleanly to SQL operations appropriately isolating data structures.

**Recommendation:** A fully decoupled `tests/e2e/admin.spec.ts` should be built relying on the existing Playwright database fixture engine to automate the verification of the Administrative Dashboard UI matrix.