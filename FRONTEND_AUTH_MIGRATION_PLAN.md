# Frontend Authentication Migration Plan

This document outlines the strategy for migrating the `LearnX` React frontend from the legacy client-side, `localStorage`-based authentication model (where `learnx_auth_user` was the source of truth) to the new secure, HTTP-only cookie-based session architecture powered by the Express backend.

## 1. App Startup Session Check & Protected Screens 

**Current Behavior:** 
`App.tsx` retrieves the initial `currentUser` synchronously from `localStorage.getItem('learnx_auth_user')`.

**Migration Path:**
1. Remove the synchronous `localStorage` read for the initial `currentUser` state.
2. Introduce a new state variable: `const [isAuthLoading, setIsAuthLoading] = useState(true);`.
3. In a `useEffect` on mount, fetch `GET /api/auth/me` (with `credentials: 'include'` if using fetch API, or equivalent in Axios).
4. **Behavior on Success (200):** Hydrate `currentUser` with the backend-verified user object (which contains the verified role).
5. **Behavior on Failure (401/403) or Unauthenticated:** Set `currentUser` to `null` (guest state).
6. **While Loading:** Return a full-screen loading spinner component (or skeleton UI) if trying to access a protected app route, preventing the UI from flashing a "Guest" view before the session check resolves. 

## 2. Login, Registration, and Account Claim Workflows

**Current Behavior:**
`AuthModal` directly updates `currentUser` via simulated login or simple backend replies, relying locally on the responses and ignoring actual session cookies.

**Migration Path:**
1. **API Utility Updates:** Ensure `apiLoginUser`, `apiInstitutionLogin`, and `/register` endpoints use `credentials: 'include'` to accept HTTP-only cookies in their responses.
2. **Handling Legacy Accounts (`needsClaim`):**
   - The new backend returns `{ success: false, error: '...', needsClaim: true }` (Status 403) for legacy accounts that have no password.
   - `AuthModal.tsx` must introduce a new `authMode` state: `'claim_account'`.
   - When a login response includes `needsClaim: true`, shift the modal into the `'claim_account'` view.
   - Prompt the user to "Set a secure password". Submit this to `POST /api/auth/claim-password` `{ email, newPassword }`.
   - On success, automatically log them in or redirect them to sign in again.
3. **Demo Accounts:** "1-Click Demo" buttons (e.g., `handleQuickDemoInstitution`) bypass true auth by generating fake `UserProfile` objects. Update these to actually utilize backend-seeded test credentials, or remove them in production to prevent bypassing the cookie requirement.

## 3. Session Expiration & Logout Workflows

**Current Behavior:**
Logout simply calls `localStorage.removeItem('learnx_auth_user')` and sets `currentUser(null)`. Expired sessions don't actively kick the user out since the app relies on localStorage.

**Migration Path:**
1. **Logout Action:** Update `handleLogout` in `App.tsx` to execute a `POST /api/auth/logout`. Upon a successful 200 response, clear the frontend `currentUser` state and navigate standard users to the `'path'` tab.
2. **Expired Session Handling:** 
   - Add a global Axios interceptor (or fetch wrapper in `studentStorage.ts`) to intercept `401 Unauthorized` responses from data fetching endpoints (e.g., `/api/users/:id/progress`). 
   - When a 401 is encountered, immediately set `currentUser(null)` to trigger the guest state and optionally pop up the `AuthModal` notifying the user: "Your session has expired. Please log in again."

## 4. Unavailable Server & Offline Resilience

1. **Server Unreachable:** If `GET /api/auth/me` fails due to a `TypeError: Failed to fetch` (network error / 502 Bad Gateway), display a dedicated `Server Unavailable` screen rather than defaulting the user to a guest. 
2. **Data Syncing:** Progress updates (like `apiSaveStudentProgress`) should queue locally if the server is unreachable, but *authorization* must strictly rely on the server. If the server is offline, new authentication attempts must fail gracefully.

## 5. Security & Deprecation of LocalStorage Authorization

1. **Role Verification:** Code like `isVerifiedTeacher` and `isAdmin` inside `App.tsx` must ONLY derive their boolean values from the `currentUser` object strictly populated by `/api/auth/me`. 
2. **LocalStorage Cleanup:** Remove all `localStorage.setItem('learnx_auth_user', ...)` syncing inside `useEffect` and login handlers. The browser's invisible cookie jar will now natively manage the session. Only non-auth preferences (like Theme or Font size) should remain in localized storage.

## 6. Required Frontend & API Integration Tests

To ensure the migration acts as expected without degrading UX:
1. **Test Session Startup:** Mock `GET /api/auth/me` returning 200 vs 401 and verify routing strictly loads protected Teacher/Admin tabs or boots to the Guest view.
2. **Test Account Claim Flow:** Mock a login returning `needsClaim: true` and verify the `AuthModal` shifts appropriately, successfully requesting `/api/auth/claim-password`. 
3. **Test Logout Flow:** Ensure `POST /api/auth/logout` drops the `currentUser` state and kicks the user back to the primary Knowledge Graph without displaying old cached role tabs.
4. **Test Global 401 Interception:** Fire an API request that returns 401, verify that the frontend synchronously wipes the current user session and raises the auth modal prompt. 

## 7. Staged Implementation Order

1. **Stage 1 (API Client Updates):** Add `credentials: 'include'` to all `fetch` calls dynamically interacting with `/api/auth/*` or `/api/users/*`.
2. **Stage 2 (Account Claim UI):** Build the `claim_account` UI flow in `AuthModal.tsx` and connect it to `POST /api/auth/claim-password`. Ensure old users don't get soft-locked. 
3. **Stage 3 (App Mount Check):** Refactor `App.tsx` `useState` initializers. Implement the `isAuthLoading` check mapping to `/api/auth/me`. 
4. **Stage 4 (LocalStorage Purge):** Delete all occurrences of `learnx_auth_user` logic inside `App.tsx` and `studentStorage.ts`. Test manually against a running local backend.
5. **Stage 5 (Global 401 Handling):** Inject the fetch response interceptor for managing expiring session cookies to force a clean logout state.