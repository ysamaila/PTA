# PTA Backend - Authentication & Authorization Module

A secure, modular, and production-ready authentication and role-based access control (RBAC) foundation for the Parent-Teacher Association (PTA) platform. Built with **NestJS**, **Prisma ORM**, **PostgreSQL (Neon)**, **Argon2id**, and **Brevo Transactional Email**.

---

## 🛠️ Tech Stack & Architecture

- **Backend Framework**: [NestJS](https://nestjs.com/) v11 (TypeScript, strict mode, `nodenext` modules)
- **Database & ORM**: [PostgreSQL (Neon)](https://neon.tech/) with [Prisma 7](https://www.prisma.io/) and `@prisma/adapter-pg`
- **Password Security**: **Argon2id** (`timeCost: 3`, `memoryCost: 65536`, `parallelism: 4`)
- **Email Delivery**: **Brevo Transactional API** delivering 6-digit verification codes
- **Authentication**: Stateless JWT access tokens + cryptographically secure SHA-256 hashed refresh tokens with automatic rotation and reuse detection
- **Authorization**: Reusable Role-Based Access Control (`@Roles()`, `RolesGuard`, `@CurrentUser()`)
- **API Documentation**: [Swagger / OpenAPI 3.0](https://swagger.io/) auto-generated at `/api/docs`
- **Rate Limiting**: `@nestjs/throttler` global request rate limiting

---

## 📋 Features

- **Parent Authentication**: Self-registration, 6-digit OTP verification via Brevo, login, and profile management.
- **Teacher Authentication**: Registration with subject specialization, OTP verification, and administrative approval gating.
- **Account Status Lifecycle**:
  - `PENDING_VERIFICATION`: Initial state upon registration; login is forbidden until 6-digit OTP is verified.
  - `PENDING_APPROVAL`: Automatically applied to teachers after email verification; restricted resources require administrator approval.
  - `ACTIVE`: Active accounts permitted to access authorized features.
  - `SUSPENDED` / `DISABLED`: Instantly blocked at the guard and login layers.
- **Cross-Role Portal Isolation**: Strict backend role verification prevents parents from authenticating through the teacher portal and vice-versa.
- **Token Security**: Refresh token rotation issues a new token pair on each exchange; presentation of an already revoked token triggers immediate revocation of all user sessions (token reuse detection).

---

## 🌐 API Endpoints

Interactive Swagger documentation is available locally at: **`http://localhost:4000/api/docs`**

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/parent/register` | Register new parent account and send OTP | None |
| `POST` | `/api/auth/teacher/register` | Register new teacher account and send OTP | None |
| `POST` | `/api/auth/verify-code` | Verify 6-digit OTP delivered via Brevo | None |
| `POST` | `/api/auth/resend-code` | Resend 6-digit OTP (60s rate limit) | None |
| `POST` | `/api/auth/parent/login` | Authenticate parent and receive JWT tokens | None |
| `POST` | `/api/auth/teacher/login` | Authenticate teacher and receive JWT tokens | None |
| `POST` | `/api/auth/refresh` | Rotate and exchange refresh token for new tokens | None |
| `POST` | `/api/auth/logout` | Invalidate active refresh tokens | Bearer JWT |
| `GET` | `/api/auth/me` | Fetch authenticated user's profile | Bearer JWT |

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory based on `.env.example`:

```env
# Application
APP_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Database (PostgreSQL / Neon)
DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"

# JWT Authentication
JWT_SECRET=super-secret-jwt-key-minimum-32-chars-long
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7

# Brevo (Sendinblue) Transactional Email
BREVO_API_KEY=xkeysib-your-brevo-api-key
BREVO_SENDER_EMAIL=yusuf.hilside@gmail.com
BREVO_SENDER_NAME=PTA
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Generate Prisma Client & Run Migrations
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 3. Run the Application
- **Development Mode** (with hot reload):
  ```bash
  npm run start:dev
  ```
- **Production Mode** (fast pre-compiled execution):
  ```bash
  npm run build
  npm run start:prod
  ```

---

## 🧪 Testing & Verification

Run the automated test suites and quality checks:

```bash
# Run all quality checks (lint + typecheck + unit + e2e)
npm run check:all

# Run unit tests (24 tests across auth, tokens, roles)
npm test

# Run E2E tests (including Swagger documentation validation)
npm run test:e2e

# Run linter
npm run lint

# Run TypeScript type check
npm run typecheck

# Run real-user lifecycle simulation
node scripts/simulate-user-flows.mjs
```

---

## 🚢 Deployment (Render)

This repository includes pre-configured scripts for zero-downtime deployment on [Render](https://render.com/):

- **Build Command**:
  ```bash
  npm run render:build
  ```
  *(Generates Prisma Client, applies production migrations, and compiles NestJS)*

- **Start Command**:
  ```bash
  npm run render:start
  ```

---

## 🔌 How Future Modules Reuse This Auth Foundation

Future feature modules (e.g. Announcements, Attendance, Grades, Payments) can protect their controllers using the shared guards and decorators:

```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums';

@Controller('api/announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {

  // Only teachers can create announcements
  @Post()
  @Roles(Role.TEACHER)
  createAnnouncement(@CurrentUser() user: AuthenticatedUser) {
    return { authorId: user.id };
  }

  // Both parents and teachers can view announcements
  @Get()
  @Roles(Role.PARENT, Role.TEACHER)
  getAnnouncements() {
    return [];
  }
}
```

---

## 📄 License

UNLICENSED - Private repository for PTA Project.
