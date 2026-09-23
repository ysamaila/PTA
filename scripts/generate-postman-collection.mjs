import fs from 'fs';

const collection = {
  info: {
    _postman_id: "8c7b6d1e-2f3a-4b5c-9d0e-1f2a3b4c5d6e",
    name: "PTA Authentication API",
    description: "PTA Authentication Module with Role-Based Access Control and Brevo OTP Verification",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    {
      key: "baseUrl",
      value: "https://pta-wdln.onrender.com",
      type: "string"
    },
    {
      key: "accessToken",
      value: "",
      type: "string"
    },
    {
      key: "refreshToken",
      value: "",
      type: "string"
    }
  ],
  item: [
    {
      name: "Health & Keep-Alive",
      item: [
        {
          name: "Health Check / Keep-Alive",
          request: {
            method: "GET",
            header: [
              {
                key: "Accept",
                value: "text/plain",
                type: "text"
              }
            ],
            url: {
              raw: "{{baseUrl}}/",
              host: ["{{baseUrl}}"],
              path: [""]
            },
            description: "Root endpoint that returns 'PTA Backend Running' and resets Render inactivity timer."
          },
          response: []
        }
      ]
    },
    {
      name: "Authentication",
      item: [
        {
          name: "Register Parent",
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json",
                type: "text"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify(
                {
                  email: "parent@example.com",
                  password: "Password123!",
                  fullName: "Sarah Johnson",
                  phone: "+1234567890"
                },
                null,
                2
              ),
              options: {
                raw: {
                  language: "json"
                }
              }
            },
            url: {
              raw: "{{baseUrl}}/api/auth/parent/register",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "parent", "register"]
            },
            description: "Register a new parent account. Dispatches 6-digit OTP via Brevo."
          },
          response: []
        },
        {
          name: "Register Teacher",
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json",
                type: "text"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify(
                {
                  email: "teacher@example.com",
                  password: "TeacherPass123!",
                  fullName: "Mr. David Clark",
                  phone: "+1234567891",
                  subjectSpecialization: "Mathematics & Science"
                },
                null,
                2
              ),
              options: {
                raw: {
                  language: "json"
                }
              }
            },
            url: {
              raw: "{{baseUrl}}/api/auth/teacher/register",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "teacher", "register"]
            },
            description: "Register a new teacher account. Dispatches 6-digit OTP via Brevo."
          },
          response: []
        },
        {
          name: "Verify Email (OTP)",
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json",
                type: "text"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify(
                {
                  email: "parent@example.com",
                  code: "123456"
                },
                null,
                2
              ),
              options: {
                raw: {
                  language: "json"
                }
              }
            },
            url: {
              raw: "{{baseUrl}}/api/auth/verify-code",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "verify-code"]
            },
            description: "Verify email using 6-digit OTP received via email."
          },
          response: []
        },
        {
          name: "Resend OTP Code",
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json",
                type: "text"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify(
                {
                  email: "parent@example.com"
                },
                null,
                2
              ),
              options: {
                raw: {
                  language: "json"
                }
              }
            },
            url: {
              raw: "{{baseUrl}}/api/auth/resend-code",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "resend-code"]
            },
            description: "Resend 6-digit verification code with rate-limiting protection."
          },
          response: []
        },
        {
          name: "Login Parent",
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json",
                type: "text"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify(
                {
                  email: "parent@example.com",
                  password: "Password123!"
                },
                null,
                2
              ),
              options: {
                raw: {
                  language: "json"
                }
              }
            },
            url: {
              raw: "{{baseUrl}}/api/auth/parent/login",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "parent", "login"]
            },
            description: "Log in as parent. Returns accessToken, refreshToken, and user profile."
          },
          response: []
        },
        {
          name: "Login Teacher",
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json",
                type: "text"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify(
                {
                  email: "teacher@example.com",
                  password: "TeacherPass123!"
                },
                null,
                2
              ),
              options: {
                raw: {
                  language: "json"
                }
              }
            },
            url: {
              raw: "{{baseUrl}}/api/auth/teacher/login",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "teacher", "login"]
            },
            description: "Log in as teacher. Teacher must have ACTIVE status (approved)."
          },
          response: []
        },
        {
          name: "Refresh Access Token",
          request: {
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json",
                type: "text"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify(
                {
                  refreshToken: "{{refreshToken}}"
                },
                null,
                2
              ),
              options: {
                raw: {
                  language: "json"
                }
              }
            },
            url: {
              raw: "{{baseUrl}}/api/auth/refresh",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "refresh"]
            },
            description: "Rotate refresh token. Returns a new access and refresh token pair."
          },
          response: []
        },
        {
          name: "Get Current User Profile (/me)",
          request: {
            auth: {
              type: "bearer",
              bearer: [
                {
                  key: "token",
                  value: "{{accessToken}}",
                  type: "string"
                }
              ]
            },
            method: "GET",
            header: [
              {
                key: "Accept",
                value: "application/json",
                type: "text"
              }
            ],
            url: {
              raw: "{{baseUrl}}/api/auth/me",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "me"]
            },
            description: "Get authenticated user profile. Requires Bearer JWT in header."
          },
          response: []
        },
        {
          name: "Logout",
          request: {
            auth: {
              type: "bearer",
              bearer: [
                {
                  key: "token",
                  value: "{{accessToken}}",
                  type: "string"
                }
              ]
            },
            method: "POST",
            header: [
              {
                key: "Content-Type",
                value: "application/json",
                type: "text"
              }
            ],
            body: {
              mode: "raw",
              raw: JSON.stringify(
                {
                  refreshToken: "{{refreshToken}}"
                },
                null,
                2
              ),
              options: {
                raw: {
                  language: "json"
                }
              }
            },
            url: {
              raw: "{{baseUrl}}/api/auth/logout",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "logout"]
            },
            description: "Invalidates active session and refresh token."
          },
          response: []
        }
      ]
    }
  ]
};

fs.writeFileSync('pta.postman_collection.json', JSON.stringify(collection, null, 2));
console.log('Successfully generated clean Postman v2.1.0 collection!');
