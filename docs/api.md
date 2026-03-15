# API Guide

## Auth and Extension

### `POST /api/auth/extension/pair`

Creates a short-lived pairing code for the authenticated client user.

Request:

```json
{
  "deviceName": "MacBook Pro Chrome"
}
```

Response:

```json
{
  "pairingCode": "AB3DF7KQ",
  "expiresAt": "2026-03-12T10:15:00.000Z"
}
```

### `POST /api/auth/extension/exchange`

Consumes a pairing code and creates an extension installation.

Request:

```json
{
  "pairingCode": "AB3DF7KQ",
  "deviceName": "MacBook Pro Chrome",
  "browserName": "Google Chrome",
  "extensionVersion": "0.1.0"
}
```

Response:

```json
{
  "installationId": "uuid",
  "accessToken": "signed-access-token",
  "refreshToken": "opaque-refresh-token",
  "remainingSeconds": 3600,
  "sessionStatus": "session_inactive"
}
```

### `POST /api/auth/extension/refresh`

Rotates a refresh token and returns a new short-lived access token.

## Client

Portal routes support either a Supabase bearer token or the authenticated Supabase session cookies used by the web app.

### `GET /api/client/wallet`

Returns the remaining wallet balance in seconds.

### `POST /api/client/sessions/start`

Starts or resumes an existing paused session if credits are sufficient.

### `POST /api/client/sessions/pause`

Pauses the current session.

### `POST /api/client/sessions/resume`

Resumes a paused session if credits are sufficient.

### `POST /api/client/sessions/end`

Ends the current session.

### `POST /api/client/analyze`

Validates the active session, detects subject/category, extracts the question, retrieves matching chunks, and returns a suggestion-only response.

Request:

```json
{
  "mode": "analyze",
  "pageSignals": {
    "pageUrl": "https://lms.example.com/course/physics",
    "pageDomain": "lms.example.com",
    "pageTitle": "Physics Midterm Quiz",
    "headings": ["Question 1"],
    "breadcrumbs": ["Courses", "Physics"],
    "visibleLabels": ["A", "B", "C"],
    "visibleTextExcerpt": "What is force?",
    "questionText": "What is force?",
    "options": ["Mass times acceleration", "Energy per second"],
    "courseCodes": ["PHY101"],
    "extractedAt": "2026-03-12T10:00:00.000Z"
  },
  "screenshotDataUrl": null,
  "manualSubject": "",
  "manualCategory": "",
  "sessionId": "uuid",
  "liveAssist": false
}
```

Response:

```json
{
  "answerText": "Mass times acceleration.",
  "shortExplanation": "The reviewer defines force as mass multiplied by acceleration.",
  "suggestedOption": "Mass times acceleration",
  "subject": "Physics",
  "category": "Midterm",
  "confidence": 0.89,
  "warning": null,
  "retrievalStatus": "Searched 4 chunks in Physics / Midterm.",
  "remainingSeconds": 3540
}
```

### `POST /api/client/payments/create-checkout`

Creates a Stripe Checkout Session for a one-time top-up package.

### `GET /api/client/payments/history`

Returns payment history for the authenticated client.

### `GET /api/client/devices`

Returns the authenticated client's paired extension installations.

### `POST /api/client/devices/revoke`

Revokes an extension installation and all active refresh tokens for that device.

## Public

### `GET /api/public/payment-packages`

Returns the active top-up package catalog for pricing and buy-credit screens.

## Admin

Admin routes require an authenticated `admin` or `super_admin` user via bearer token or the web app's Supabase session cookies.

### `GET /api/admin/users`

Returns server-formatted user management rows including wallet balance, wallet status, session sample count, and last session timestamp.

### `GET /api/admin/payments`

Returns payment operations metrics plus the latest payment rows with user and package labels.

### `GET /api/admin/sessions`

Returns recent session monitoring rows including subject/category labels, detection mode, duration, and a basic suspicious-flag summary.

### `GET /api/admin/audit-logs`

Returns recent audit log rows with actor identity, event type, entity reference, and event summary.

### `GET /api/admin/reports`

Returns the server-backed reporting payload used by the admin reports page.

## Webhooks

### `POST /api/webhooks/stripe`

Requires the `stripe-signature` header. Credits are provisioned only on verified completion events.

## Error Shape

All route handlers return:

```json
{
  "error": "Human-readable message",
  "code": "machine_readable_code",
  "details": null
}
```
