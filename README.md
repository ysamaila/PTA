# PTA Backend Service: Authentication & Access Control Engine

A robust, enterprise-grade authentication and role-based access control (RBAC) foundation engineered for the Parent-Teacher Association (PTA) platform. Built with **NestJS**, **Prisma ORM**, **PostgreSQL (Neon)**, **Argon2id**, and **Brevo Transactional Email Services**.

---

## 1. Architectural Overview

The service delivers a decoupled authentication core designed to support horizontal expansion as future domain modules (academics, payments, communications) are introduced.

### Technology Foundation

* **Application Framework:** NestJS v11 (TypeScript, strict mode, NodeNext module resolution)
* **Data Access Layer:** Prisma ORM 7 with native PostgreSQL driver adapter (`@prisma/adapter-pg`)
* **Database Engine:** PostgreSQL hosted on Neon (Serverless with pooled connections)
* **Cryptographic Hashing:** Argon2id (`timeCost: 3`, `memoryCost: 65536`, `parallelism: 4`)
* **Verification Transport:** Brevo Transactional Email API (REST/HTTPS over TLS 1.3)
* **Token Management:** Asymmetric/symmetric short-lived JWT access tokens with rotating cryptographic refresh tokens
* **Contract Specification:** OpenAPI 3.0 / Swagger UI mounted at `/api/docs`
* **Defensive Controls:** Global input validation pipes with strict whitelisting and rate limiting via `@nestjs/throttler`

---

## 2. Security Architecture and Threat Mitigations

### Credential Storage
All user passwords are encrypted using **Argon2id**, the modern standard resistant to GPU/ASIC-assisted brute-force attacks and side-channel timing analysis. Plaintext credentials are never persisted or logged.

### Role Isolation and Escalation Prevention
User roles (`PARENT`, `TEACHER`, `ADMIN`) are assigned exclusively through backend service logic. Client payloads containing privileged fields are rejected by NestJS `ValidationPipe` with `forbidNonWhitelisted: true`. Cross-portal authentications are rejected at the authentication layer (e.g., Parent credentials supplied to the Teacher login endpoint return an immediate `401 Unauthorized`).

### Token Rotation and Session Replay Detection
Refresh tokens are stored exclusively as SHA-256 digests in PostgreSQL. During token rotation:
1. The incoming refresh token is verified against the database digest.
2. The existing token is marked as revoked and linked to the new token ID.
3. If an already revoked token is submitted, the system flags a session replay attack and invalidates all active sessions belonging to the compromised user account.

### Account State Machine
The platform enforces a deterministic lifecycle:
* `PENDING_VERIFICATION`: Initial state upon self-registration. All authenticated endpoints and logins are blocked until the 6-digit OTP is verified.
* `PENDING_APPROVAL`: Automatically applied to Teachers following email verification. Restricted teaching and academic resources require explicit administrative approval before access is granted.
* `ACTIVE`: Fully verified and authorized account.
* `SUSPENDED` / `DISABLED`: Requests are immediately intercepted and terminated by `RolesGuard` and `JwtAuthGuard`.

---

## 3. API Specification

All endpoints are documented interactively in Swagger UI at: `http://localhost:4000/api/docs`

| HTTP Method | Route Path | Purpose | Authorization Required |
|---|---|---|---|
| `POST` | `/api/auth/parent/register` | Register a new Parent account and dispatch verification OTP | Public |
| `POST` | `/api/auth/teacher/register` | Register a new Teacher account and dispatch verification OTP | Public |
| `POST` | `/api/auth/verify-code` | Verify 6-digit OTP code received via Brevo | Public |
| `POST` | `/api/auth/resend-code` | Request a new verification OTP (rate-limited to 60s cooldown) | Public |
| `POST` | `/api/auth/parent/login` | Authenticate Parent credentials and receive session tokens | Public |
| `POST` | `/api/auth/teacher/login` | Authenticate Teacher credentials and receive session tokens | Public |
| `POST` | `/api/auth/refresh` | Exchange a valid refresh token for a rotated token pair | Public |
| `POST` | `/api/auth/logout` | Revoke active refresh token and invalidate user session | Bearer JWT |
| `GET` | `/api/auth/me` | Fetch authenticated identity and profile metadata | Bearer JWT |

---

## 4. Environment Configuration

Configuration is managed via environment variables. Create a local `.env` file following `.env.example`:

| Variable | Description | Example / Default |
|---|---|---|
| `APP_ENV` | Application runtime environment (`development`, `production`, `test`) | `development` |
| `PORT` | Local network binding port | `4000` |
| `CORS_ORIGIN` | Permitted cross-origin origins (comma-separated) | `http://localhost:3000,http://localhost:5173` |
| `DATABASE_URL` | Neon PostgreSQL pooled connection URI | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | Secret key used for signing JWT access tokens (minimum 32 characters) | Generated 256-bit secret string |
| `JWT_EXPIRES_IN` | Access token time-to-live | `15m` |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Refresh token retention duration | `7` |
| `BREVO_API_KEY` | Transactional email API key from Brevo console | `xkeysib-...` |
| `BREVO_SENDER_EMAIL` | Verified transactional sender address | `yusuf.hilside@gmail.com` |
| `BREVO_SENDER_NAME` | Display name for outbound verification emails | `PTA` |

---

## 5. Development and Database Lifecycle

### Prerequisites
* Node.js v20.19.0 or higher (v22.x LTS recommended)
* npm v10.x or higher
* PostgreSQL connection string (Neon or local instance)

### Installation
```bash
npm install
```

### Database Synchronization
Generate the Prisma Client and synchronize migrations:
```bash
npm run prisma:generate
npx prisma migrate dev
```

### Running the Service
* **Development Mode (with hot-reload):**
  ```bash
  npm run start:dev
  ```
* **Production Mode (compiled JavaScript):**
  ```bash
  npm run build
  npm run start:prod
  ```

---

## 6. Verification and Quality Engineering

The service includes an end-to-end testing suite covering unit validation, integration workflows, API schemas, and linter enforcement:

```bash
# Execute full quality gate (Lint, Typecheck, Unit Tests, and E2E Tests)
npm run check:all

# Run isolated unit test suites (24 tests across AuthService, TokenService, RolesGuard)
npm test

# Run HTTP integration and Swagger contract validation
npm run test:e2e

# Execute TypeScript type checker without emission
npm run typecheck

# Execute ESLint verification
npm run lint

# Execute live real-user simulation script against active database
node scripts/simulate-user-flows.mjs
```

---

## 7. Cloud Deployment (Render Blueprint)

The service is pre-configured for automated, zero-downtime deployment on Render:

* **Build Command:**
  ```bash
  npm run render:build
  ```
  *Executes Prisma Client generation, applies pending migrations to PostgreSQL, and compiles NestJS to `/dist`.*

* **Start Command:**
  ```bash
  npm run render:start
  ```
  *Runs the production application bundle directly via Node.js.*

---

## 8. Integration Guide for Upstream Domain Modules

Upstream feature modules (e.g., Announcements, Attendance, Grades, Student Management) should consume the shared authentication and RBAC infrastructure directly.

### Securing Module Endpoints

```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';

@Controller('api/academic-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicReportsController {

  // Restricted to Teachers with verified and approved status
  @Post()
  @Roles(Role.TEACHER)
  publishReport(@CurrentUser() user: AuthenticatedUser) {
    return { educatorId: user.id };
  }

  // Accessible to both Parents and Teachers
  @Get()
  @Roles(Role.PARENT, Role.TEACHER)
  listReports(@CurrentUser() user: AuthenticatedUser) {
    return { viewerRole: user.role };
  }
}
```

---

## 9. License

UNLICENSED. Proprietary and confidential software belonging to the PTA Project.
