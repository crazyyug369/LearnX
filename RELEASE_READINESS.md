# LearnX Release Readiness & Architecture review

## System Architecture Overview

**Frontend:** TypeScript React application bundled with Vite. Styled with TailwindCSS and Lucide for iconography, and data visualizations utilizing Recharts. Animations implemented with Framer Motion. 

**Backend:** Node.js Express server (server.ts). Serves as both an API layer and, when built, the static file server for the React dist. Built with esbuild for production.

**Database:** MySQL accessed directly via mysql2 driver (src/serverDb.ts). No ORM (like Prisma or TypeORM) is used; schemas and migrations are handled via raw SQL queries.

**AI Integration / Gemini:** Google's @google/genai library is used inside server.ts to power multiple features (tutor chat, adaptive testing, question generation). The client is dynamically initialized and can respond to environment variables or admin-defined cached settings.

## Configuration Requirements (Environment Variables)
For production deployments, the following variables must be supplied:
- GEMINI_API_KEY: Required for AI generation flows.
- MYSQL_HOST: Database hostname.
- MYSQL_PORT: Database port (default 3306).
- MYSQL_USER: Database username.
- MYSQL_PASSWORD: Database password.
- MYSQL_DATABASE: Production database name.
- PORT: Express server listening port.

*Note: The .env file is properly ignored by .gitignore, but the server's fallback defaults should be removed before release.*

## Account Types & Intended Boundaries
The application schema defines four primary roles in an ENUM:
- **Student**: Has access to their own progress dashboard, quizzes, and adaptive learning instances.
- **Teacher**: Can manage student cohorts, monitor struggling concepts, generate worksheets, and deploy interventions.
- **Institution**: Oversees multiple teachers and cohorts. Features aggregate dashboards and school-level analytics. 
- **Admin**: Has platform-wide control to create/update/delete users, configure global settings, and audit system logs.

## Critical Route Map
- **Learner Progress:** GET/PUT /api/users/:userId/progress, POST /api/diagnostic/calibrate, GET /api/student/quiz-attempts/:userId
- **Institution Data:** POST /api/auth/institution-login, GET /api/institutions/verify-code/:code, GET /api/admin/institutions/:id/*
- **Administration:** GET/POST/PUT/DELETE /api/admin/users, GET /api/admin/stats, GET /api/admin/audit-logs, GET/POST/DELETE /api/admin/questions
- **AI Features:** POST /api/ai/adaptive-lesson, POST /api/ai/tutor-chat, POST /api/ai/generate-question, POST /api/curriculum/ai-suggest

## Missing Production-Readiness Controls

- **Authentication & Role Validation:** The /api/auth/login and /api/auth/register flows do not implement token-based authentication (such as JWT/Sessions) or password verification logic. Endpoint authorization wrappers are missing, which means APIs currently trust incoming requests blindly.
- **Request Validation:** No schema validation libraries (e.g., Zod, express-validator) exist in package.json. Data is mapped directly from eq.body to database queries.
- **Error Handling & Failure States:** A centralized Express error handler is missing. Server errors are occasionally logged to console.error and return opaque 500 status codes instead of standardized API responses (e.g. JSON API specifications). 
- **Deployment & Security Headers:** helmet and cors are missing from the Express pipeline. Cross-origin restrictions are effectively disabled.
- **Rate Limiting:** Production protection mechanisms like express-rate-limit have not been implemented on computationally heavy endpoints (like /api/ai/*).
- **Test Coverage:** No automated testing frameworks (jest, itest) are configured in the package.json.
- **Logging:** Only simplistic console.log interceptors are used; production telemetry, request tracing, and APM logging are unconfigured.

## Maintenance and Repair Order

### P0 (Must Fix Before Launch)
1. **Authentication Framework Implementation:** Implement a standard credential verification flow and session/JWT issuance. Replace the dynamic enroll-or-login pattern in uthenticateOrEnrollUser with secure boundaries.
2. **Access Control (Authorization) Wrappers:** Enforce role-based access control (RBAC). Admin APIs /api/admin/* must strictly validate the token to ensure the requesting identity holds the dmin role. 
3. **Remove Hardcoded Defaults:** Remove fallback strings (like the default Gemini key) from server.ts to enforce explicit environment variable extraction. Ensure graceful degradation if credentials are missing upon boot.

### P1 (Fast Follow - High Priority)
1. **Request Schema Validation:** Install a payload validator to parse and cleanse incoming eq.body and query parameters.
2. **Rate Limiting & Stability:** Add aggressive rate limits to the AI-generation endpoints to protect the upstream Gemini API budget and server availability. 
3. **CORS & General Request Hardening:** Include proper origin blocking and request shaping dependencies.

### P2 (Technical Debt)
1. **Centralized Error Handling:** Refactor route logic to pipe standard application errors to a global middleware that formats user-friendly JSON failures.
2. **Automated Testing Suite:** Establish API and Component testing for critical learning paths. 
3. **Structured Logging:** Centralize system logs through a standardized library.
