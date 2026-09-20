# Authentication Migration Plan: LearnX

## 1. Current State Assessment
After surveying the frontend components and backend Express routes, the current authentication mechanism comprises:
- **Login & Registration (Students/Teachers)**: Highly permissive. The `authenticateOrEnrollUser` flow dynamically creates a user or seamlessly authenticates them simply by string-matching an email, name, or ID. No passwords are created or checked for standard users.
- **Institution Login**: Features a plaintext password check (`if (inst.password === password)`) alongside a hardcoded universal backdoor passkey (`learnx@123`).
- **Frontend Storage**: The client stores the user's raw JSON profile inside `localStorage.learnx_auth_user` and trusts its contents to grant role-specific UI visibility (e.g., rendering the Admin Dashboard if `role === 'admin'`). 
- **API Protection**: There are no backend middleware checks. Critical endpoints like `/api/admin/users`, `/api/users/:userId/progress`, and AI capabilities blindly trust the client requests.

---

## 2. Recommended Production-Ready Design

**Choice: JWT (JSON Web Token) inside HTTP-Only Cookies**
- *Reasoning*: A React SPA coupled with an Express backend on the same apex domain benefits substantially from HTTP-Only cookies over `localStorage` JWTs. HTTP-Only cookies entirely mitigate XSS (Cross-Site Scripting) token theft. Stateless JWTs avoid the need for a Redis session-store cluster, which is the least disruptive topology shift for your current architecture, while ensuring rapid authentication across the API surface.

**Key Components:**
- **Password Hashing**: Adopt `bcrypt` with a minimum work factor of 10 for storing credentials.
- **Role Isolation**: Strict boundary definitions for the 4 roles (`student`, `teacher`, `institution`, `admin`).
- **Middleware**: Express server-side middleware pipeline to intercept and reject unauthorized queries prior to business logic execution.

---

## 3. Structural Changes Needed

### Backend (Express & MySQL)
1. **Dependencies**: Introduce `bcrypt`, `jsonwebtoken`, and `cookie-parser`.
2. **Schema Update**: Add a `password_hash` column to the `users` table and map it appropriately in the `institutions` table.
3. **Refactor Auth Routes**: Replace the dynamic enrollment function with standard `/api/auth/register`, `/api/auth/login`, and `/api/auth/me` endpoints. 
4. **Authorization Middleware**:
   - `verifyToken`: Decodes the JWT, validates the signature, and mounts `req.user`.
   - `requireRole(roles)`: Ensures `req.user.role` is within the permitted array for the endpoint.
5. **Route Hardening**: Apply `verifyToken` universally across protected routes, and `requireRole(['admin'])` strictly on `server.ts` administration endpoints.

### Frontend (React)
1. **Storage Shift**: Stop relying on `localStorage` to determine auth state.
2. **State Hydration**: On app load, call `/api/auth/me`. If successful, write the user data to React state/context.
3. **API Client**: Configure the global `fetch` utility (or introduce `axios`) to include `credentials: "include"`, ensuring the browser securely transmits the HTTP-Only cookie.
4. **Auth Forms**: Explicit separation between Registration (requiring password creation) and Login components.

---

## 4. Migration Approach for Existing Data
To preserve continuity for existing users who currently log in via just an email/name:
- **Institutions**: Run a one-time database migration script that hashes their existing plaintext passwords into the new `password_hash` column and drops the old plaintext column.
- **Students/Teachers**: Implement an "Account Claim" flow. Existing accounts are marked `needs_password = true`. When they attempt to "log in" with just their email/username, the UI instructs them to set a secure password, effectively transitioning them to the required standard.
- **Demo Passkeys**: The hardcoded `learnx@123` fallback must be obliterated.

---

## 5. Session & Lifecycle Behavior
- **Login**: Upon successful password verification, the server signs a JWT (containing user ID and role) and attaches it as an HTTP-Only, Secure, SameSite=Strict cookie set to expire in 4 hours.
- **Loss of Session/Expiry**: When the JWT expires, the backend will return an HTTP `401 Unauthorized`. 
- **Frontend Interceptor**: A global API response interceptor will catch `401` errors, clear the frontend memory state, and redirect the user to the login screen displaying "Session expired. Please log in again."
- **Logout**: Hitting `/api/auth/logout` commands the server to send a `Set-Cookie` header with an immediate expiration date, safely destroying the session.

---

## 6. Access Boundary Test Cases
Before fully deprecating the legacy system, the following automated assertion scenarios must pass:

1. **Vertical Isolation (Student to Admin)**: Log in as a Student. Read the HTTP-Only cookie. Attempt to invoke `GET /api/admin/stats`. 
   *Expected outcome*: `403 Forbidden`.
2. **Horizontal Isolation (Student to Student)**: Log in as Student A. Attempt a progress modification via `PUT /api/users/<Student_B_ID>/progress`.
   *Expected outcome*: `403 Forbidden` (Users can only modify targets matching their own token ID).
3. **Teacher Visibility Limits**: Log in as a Teacher. Attempt to modify institutional parameters or fetch the global AI billing dashboard.
   *Expected outcome*: `403 Forbidden`.
4. **Anonymous Rejection**: Remove authentication cookies. Attempt `GET /api/teacher/cohorts`.
   *Expected outcome*: `401 Unauthorized`.

---

## 7. Rollback Plan
To mitigate launch risk:
- Expose the old `authenticateOrEnrollUser` functionality under a secluded `/api/auth/legacy-login` route gated heavily by a server environment variable (`ENABLE_LEGACY_AUTH=true`).
- If catastrophic login failures occur affecting live classrooms, the infrastructure team can toggle `ENABLE_LEGACY_AUTH` to `true` and instruct caching layers/load balancers to serve the prior frontend release (which points to the legacy endpoints and relies on `localStorage`). 
- Once rolled back, the root cause in the JWT validation or password hashing logic can be safely diagnosed in staging before attempting the migration again.
