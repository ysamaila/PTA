# PTA Backend API Endpoints Reference

Base URL: `https://pta-wdln.onrender.com`

This document provides a comprehensive reference for all HTTP endpoints exposed by the PTA Backend Authentication and System services.

---

## Quick Reference Summary

| Method | Endpoint | Full URL | Auth Required | Description |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/` | `https://pta-wdln.onrender.com/` | Public | Root health check and anti-hibernation keep-alive |
| `POST` | `/api/auth/parent/register` | `https://pta-wdln.onrender.com/api/auth/parent/register` | Public | Register new Parent account and send Brevo OTP |
| `POST` | `/api/auth/teacher/register` | `https://pta-wdln.onrender.com/api/auth/teacher/register` | Public | Register new Teacher account and send Brevo OTP |
| `POST` | `/api/auth/admin/register` | `https://pta-wdln.onrender.com/api/auth/admin/register` | Public | Register new Admin account and send Brevo OTP |
| `POST` | `/api/auth/verify-code` | `https://pta-wdln.onrender.com/api/auth/verify-code` | Public | Verify email address using 6-digit OTP |
| `POST` | `/api/auth/resend-code` | `https://pta-wdln.onrender.com/api/auth/resend-code` | Public | Resend 6-digit verification code with 60s cooldown |
| `POST` | `/api/auth/parent/login` | `https://pta-wdln.onrender.com/api/auth/parent/login` | Public | Authenticate as Parent and receive JWT pair |
| `POST` | `/api/auth/teacher/login` | `https://pta-wdln.onrender.com/api/auth/teacher/login` | Public | Authenticate as Teacher (requires ACTIVE status) |
| `POST` | `/api/auth/admin/login` | `https://pta-wdln.onrender.com/api/auth/admin/login` | Public | Authenticate as System Administrator |
| `POST` | `/api/auth/refresh` | `https://pta-wdln.onrender.com/api/auth/refresh` | Public | Rotate and exchange refresh token for new tokens |
| `POST` | `/api/auth/logout` | `https://pta-wdln.onrender.com/api/auth/logout` | Bearer JWT | Invalidate active session and revoke refresh tokens |
| `GET` | `/api/auth/me` | `https://pta-wdln.onrender.com/api/auth/me` | Bearer JWT | Retrieve profile of currently authenticated user |
| `POST` | `/api/auth/forgot-password` | `https://pta-wdln.onrender.com/api/auth/forgot-password` | Public | Initiate password reset and dispatch 6-digit OTP |
| `POST` | `/api/auth/reset-password` | `https://pta-wdln.onrender.com/api/auth/reset-password` | Public | Set new password using OTP and revoke all sessions |
| `POST` | `/api/auth/change-password` | `https://pta-wdln.onrender.com/api/auth/change-password` | Bearer JWT | Change password with current password verification |
| `GET` | `/api/docs` | `https://pta-wdln.onrender.com/api/docs` | Public | Interactive Swagger UI API documentation |
| `GET` | `/api/docs-json` | `https://pta-wdln.onrender.com/api/docs-json` | Public | Raw OpenAPI 3.0 specification in JSON format |

---

## 1. System & Health Check

### Health Check / Keep-Alive
- **URL**: `https://pta-wdln.onrender.com/`
- **Method**: `GET`
- **Authentication**: None
- **Headers**:
  ```text
  Accept: text/plain
  ```
- **Success Response (200 OK)**:
  ```text
  Hello World!
  ```
- **Notes**: Serves as the anti-hibernation keep-alive endpoint polled periodically to prevent Render free-tier spin down.

---

## 2. Account Registration

### Register Parent
- **URL**: `https://pta-wdln.onrender.com/api/auth/parent/register`
- **Method**: `POST`
- **Authentication**: None
- **Headers**:
  ```text
  Content-Type: application/json
  Accept: application/json
  ```
- **Request Body**:
  ```json
  {
    "role": "parent",
    "fullName": "Sarah Johnson",
    "email": "parent@example.com",
    "schoolName": "Greenwood High School",
    "studentCode": "STU-88392",
    "password": "Password123!",
    "confirmPassword": "Password123!",
    "termsAccepted": true
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "message": "Parent registration successful. A 6-digit verification code has been sent to your email.",
    "user": {
      "id": "c1f7a268-6d8e-4a6c-9419-f53eb905581b",
      "email": "parent@example.com",
      "role": "PARENT",
      "accountStatus": "PENDING_VERIFICATION",
      "isEmailVerified": false,
      "emailVerifiedAt": null,
      "createdAt": "2026-09-23T11:00:00.000Z",
      "profile": {
        "fullName": "Sarah Johnson",
        "schoolName": "Greenwood High School",
        "studentCode": "STU-88392",
        "phone": null,
        "subjectSpecialization": null
      }
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation failure (passwords do not match, termsAccepted is not true, invalid email, weak password).
  - `409 Conflict`: An account with this email already exists.

---

### Register Teacher
- **URL**: `https://pta-wdln.onrender.com/api/auth/teacher/register`
- **Method**: `POST`
- **Authentication**: None
- **Headers**:
  ```text
  Content-Type: application/json
  Accept: application/json
  ```
- **Request Body**:
  ```json
  {
    "role": "teacher",
    "fullName": "Mr. David Clark",
    "workEmail": "teacher@school.edu",
    "schoolName": "Greenwood High School",
    "password": "TeacherPass123!",
    "confirmPassword": "TeacherPass123!",
    "termsAccepted": true
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "message": "Teacher registration successful. A 6-digit verification code has been sent to your email.",
    "user": {
      "id": "d2e8b379-7e9f-5b7d-8520-a64fc016692c",
      "email": "teacher@school.edu",
      "role": "TEACHER",
      "accountStatus": "PENDING_VERIFICATION",
      "isEmailVerified": false,
      "emailVerifiedAt": null,
      "createdAt": "2026-09-23T11:00:00.000Z",
      "profile": {
        "fullName": "Mr. David Clark",
        "schoolName": "Greenwood High School",
        "phone": null,
        "subjectSpecialization": null
      }
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation failure (passwords do not match, termsAccepted is not true, invalid email, weak password).
  - `409 Conflict`: Email already exists.

---

### Register Admin
- **URL**: `https://pta-wdln.onrender.com/api/auth/admin/register`
- **Method**: `POST`
- **Authentication**: None
- **Headers**:
  ```text
  Content-Type: application/json
  Accept: application/json
  ```
- **Request Body**:
  ```json
  {
    "email": "admin@example.com",
    "password": "AdminPassword123!",
    "fullName": "System Administrator"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "message": "Admin registration successful. A 6-digit verification code has been sent to your email.",
    "user": {
      "id": "e3f9c480-8f0a-6c8e-9631-b75ad127703d",
      "email": "admin@example.com",
      "role": "ADMIN",
      "accountStatus": "PENDING_VERIFICATION",
      "isEmailVerified": false,
      "emailVerifiedAt": null,
      "createdAt": "2026-09-23T11:00:00.000Z",
      "profile": null
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation failure.
  - `409 Conflict`: Email already exists.

---

## 3. Email Verification & OTP

### Verify Email Code
- **URL**: `https://pta-wdln.onrender.com/api/auth/verify-code`
- **Method**: `POST`
- **Authentication**: None
- **Headers**:
  ```text
  Content-Type: application/json
  Accept: application/json
  ```
- **Request Body**:
  ```json
  {
    "email": "parent@example.com",
    "code": "123456"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Email verified successfully",
    "user": {
      "id": "c1f7a268-6d8e-4a6c-9419-f53eb905581b",
      "email": "parent@example.com",
      "role": "PARENT",
      "accountStatus": "ACTIVE",
      "isEmailVerified": true,
      "emailVerifiedAt": "2026-09-23T11:05:00.000Z"
    }
  }
  ```
- **Status Transition Logic**:
  - `PARENT` and `ADMIN` transition directly to `ACTIVE`.
  - `TEACHER` transitions to `PENDING_APPROVAL` (requires administrative approval before login).
- **Error Responses**:
  - `400 Bad Request`: Code expired, invalid digits, or attempt limit exceeded (max 5).
  - `404 Not Found`: User not found.

---

### Resend Verification Code
- **URL**: `https://pta-wdln.onrender.com/api/auth/resend-code`
- **Method**: `POST`
- **Authentication**: None
- **Headers**:
  ```text
  Content-Type: application/json
  Accept: application/json
  ```
- **Request Body**:
  ```json
  {
    "email": "parent@example.com"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Verification code resent successfully"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Rate limit active (60-second cooldown between requests) or email already verified.

---

## 4. Authentication & Sessions

### Parent Login
- **URL**: `https://pta-wdln.onrender.com/api/auth/parent/login`
- **Method**: `POST`
- **Authentication**: None
- **Headers**:
  ```text
  Content-Type: application/json
  Accept: application/json
  ```
- **Request Body**:
  ```json
  {
    "email": "parent@example.com",
    "password": "Password123!"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "user": {
      "id": "c1f7a268-6d8e-4a6c-9419-f53eb905581b",
      "email": "parent@example.com",
      "role": "PARENT",
      "accountStatus": "ACTIVE",
      "isEmailVerified": true,
      "emailVerifiedAt": "2026-09-23T11:05:00.000Z",
      "createdAt": "2026-09-23T11:00:00.000Z",
      "profile": {
        "fullName": "Sarah Johnson",
        "phone": "+1234567890",
        "subjectSpecialization": null
      }
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "48b6d19e-...",
      "expiresIn": "15m",
      "tokenType": "Bearer"
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Invalid credentials or role mismatch.
  - `403 Forbidden`: Account status is `PENDING_VERIFICATION`, `SUSPENDED`, or `DISABLED`.

---

### Teacher Login
- **URL**: `https://pta-wdln.onrender.com/api/auth/teacher/login`
- **Method**: `POST`
- **Authentication**: None
- **Headers**:
  ```text
  Content-Type: application/json
  Accept: application/json
  ```
- **Request Body**:
  ```json
  {
    "email": "teacher@example.com",
    "password": "TeacherPass123!"
  }
  ```
- **Success Response (200 OK)**: Same payload structure as Parent login with role `TEACHER`.
- **Error Responses**:
  - `401 Unauthorized`: Invalid credentials or role mismatch.
  - `403 Forbidden`: Returned when account is in `PENDING_APPROVAL` status ("Your teacher account is pending administrator approval") or `PENDING_VERIFICATION`.

---

### Admin Login
- **URL**: `https://pta-wdln.onrender.com/api/auth/admin/login`
- **Method**: `POST`
- **Authentication**: None
- **Headers**:
  ```text
  Content-Type: application/json
  Accept: application/json
  ```
- **Request Body**:
  ```json
  {
    "email": "admin@example.com",
    "password": "AdminPassword123!"
  }
  ```
- **Success Response (200 OK)**: Returns user and token pair for role `ADMIN`.
- **Error Responses**:
  - `401 Unauthorized`: Invalid credentials or role mismatch.
  - `403 Forbidden`: Account pending verification or suspended.

---

### Refresh Access Token
- **URL**: `https://pta-wdln.onrender.com/api/auth/refresh`
- **Method**: `POST`
- **Authentication**: None
- **Headers**:
  ```text
  Content-Type: application/json
  Accept: application/json
  ```
- **Request Body**:
  ```json
  {
    "refreshToken": "48b6d19e-..."
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "8f3b207a-...",
    "expiresIn": "15m",
    "tokenType": "Bearer"
  }
  ```
- **Security Feature**: Refresh token rotation with automatic reuse detection. Attempting to replay a previously rotated token revokes all tokens for that user immediately.
- **Error Responses**:
  - `401 Unauthorized`: Token invalid, expired, or compromised.

---

### Logout
- **URL**: `https://pta-wdln.onrender.com/api/auth/logout`
- **Method**: `POST`
- **Authentication**: `Bearer <accessToken>`
- **Headers**:
  ```text
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  Accept: application/json
  ```
- **Request Body (Optional)**:
  ```json
  {
    "refreshToken": "48b6d19e-..."
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Logged out successfully"
  }
  ```
- **Notes**: If `refreshToken` is provided, only that specific session is revoked. If omitted, all active sessions for the user are invalidated.
- **Error Responses**:
  - `401 Unauthorized`: Missing or invalid Bearer token.

---

## 5. Password Recovery & Management

### Forgot Password (Request OTP)
- **URL**: `https://pta-wdln.onrender.com/api/auth/forgot-password`
- **Method**: `POST`
- **Authentication**: None
- **Headers**:
  ```text
  Content-Type: application/json
  Accept: application/json
  ```
- **Request Body**:
  ```json
  {
    "email": "parent@example.com"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "If an account with that email exists, a password reset code has been sent."
  }
  ```
- **Security Features**:
  - **Account Enumeration Defense**: Returns the exact same 200 response whether the email exists or not.
  - **Rate Limiting**: Enforces a 60-second cooldown between reset requests.
  - **Brevo Delivery**: Sends a distinct password reset email with a 6-digit OTP (valid for 10 minutes).
- **Error Responses**:
  - `400 Bad Request`: Validation failure or rate limit active.

---

### Reset Password (Verify OTP & Set Password)
- **URL**: `https://pta-wdln.onrender.com/api/auth/reset-password`
- **Method**: `POST`
- **Authentication**: None
- **Headers**:
  ```text
  Content-Type: application/json
  Accept: application/json
  ```
- **Request Body**:
  ```json
  {
    "email": "parent@example.com",
    "code": "982891",
    "newPassword": "NewSecurePassword123!"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Password has been successfully reset. You may now log in with your new password."
  }
  ```
- **Security Features**:
  - Hashes `newPassword` using Argon2id.
  - Marks OTP code as used (`usedAt`).
  - Automatically revokes all existing refresh tokens for the user, forcing re-login across all active devices.
- **Error Responses**:
  - `400 Bad Request`: Code invalid, expired, max attempts exceeded, or password shorter than 8 characters.

---

### Change Password (Authenticated)
- **URL**: `https://pta-wdln.onrender.com/api/auth/change-password`
- **Method**: `POST`
- **Authentication**: `Bearer <accessToken>`
- **Headers**:
  ```text
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  Accept: application/json
  ```
- **Request Body**:
  ```json
  {
    "currentPassword": "InitialPassword123!",
    "newPassword": "UpdatedPassword456!"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Password changed successfully"
  }
  ```
- **Security Features**:
  - Validates `currentPassword` against stored Argon2 hash.
  - Rejects if `newPassword` is identical to `currentPassword`.
  - Hashes new password with Argon2id and revokes all active session tokens.
- **Error Responses**:
  - `400 Bad Request`: New password identical to current password or validation error.
  - `401 Unauthorized`: Current password does not match or invalid JWT.

---

## 6. User Profile

### Get Current User Profile
- **URL**: `https://pta-wdln.onrender.com/api/auth/me`
- **Method**: `GET`
- **Authentication**: `Bearer <accessToken>`
- **Headers**:
  ```text
  Authorization: Bearer <accessToken>
  Accept: application/json
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "id": "c1f7a268-6d8e-4a6c-9419-f53eb905581b",
    "email": "parent@example.com",
    "role": "PARENT",
    "accountStatus": "ACTIVE",
    "isEmailVerified": true,
    "emailVerifiedAt": "2026-09-23T11:05:00.000Z",
    "createdAt": "2026-09-23T11:00:00.000Z",
    "profile": {
      "fullName": "Sarah Johnson",
      "phone": "+1234567890",
      "subjectSpecialization": null
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Missing, expired, or invalid Bearer token.
  - `404 Not Found`: User account no longer exists.

---

## 7. API Documentation

### Interactive Swagger UI
- **URL**: `https://pta-wdln.onrender.com/api/docs`
- **Method**: `GET`
- **Authentication**: None
- **Content-Type**: `text/html`
- **Description**: Browser interface for exploring and executing requests against all API endpoints interactively.

### Raw OpenAPI Specification
- **URL**: `https://pta-wdln.onrender.com/api/docs-json`
- **Method**: `GET`
- **Authentication**: None
- **Content-Type**: `application/json`
- **Description**: Complete OpenAPI 3.0 specification document for automated schema generation, Postman import, and contract testing.
