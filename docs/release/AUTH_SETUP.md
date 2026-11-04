# Account providers: deployment setup

Code supports password sessions, explicit Google linking, verification email and
single-use password reset. Providers remain off until configured. Do not publish
keys or apply production migrations without backup and release review.

## Google

1. Create/configure a Google OAuth web application and its consent screen.
2. Request only OpenID, email and basic profile. Do not request Gmail, Drive or
   offline access. Add the actual application origin.
3. Register the exact callback `https://sochat.onrender.com/api/auth/google/callback`.
   For local development, use the configured API APP_ORIGIN plus the same path;
   callbacks must reach the API and share its session cookie.
4. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server only. Never prefix
   these variables with VITE_. Restart/redeploy after configuration.
5. Check successful login, rejected/cancelled consent, expired state and an
   existing password account. Existing accounts explicitly link from Settings;
   matching email alone never merges accounts. Google-only accounts can establish
   a password using mailbox recovery once email delivery is configured.

Session flow uses state, nonce, PKCE and Google library ID-token verification.
Provider subject identifies an account independently of later email changes.
Linked Google addresses must match the signed-in account email. No unlink flow is
provided yet, avoiding removal of the only usable login method.

## Resend

Verify an owned sender/domain, then configure RESEND_API_KEY and MAIL_FROM on the
server. Sender format may be `SổChat <accounts@your-verified-domain>`.
Configure sender DNS as instructed by Resend. Do not assume real delivery from a
mocked transport test or a successful HTTP response.

Users request verification in Settings or recovery from the login page. Reset
links expire after 30 minutes; verification links after 24 hours. Requesting a
new link replaces the old one. Token secrets stay in a URL fragment, are removed
from browser history upon opening and are never placed in server query strings.
The actual provider necessarily receives the email address and link. Do not send
these links to Gemini or log provider responses. Password change invalidates old
reset links. Reset revokes all sessions and also establishes mailbox verification.

Verification is recorded; it does not block previously registered users from the
ledger. No claim is made that all existing accounts are verified.

Uniform request responses avoid disclosing registered addresses in response
bodies. Limits apply per IP/address and globally; timing is not guaranteed equal.
Delivery failures emit only `account_email_failed`, never recipient/token/content.
Operators must monitor that event and investigate delivery in their provider.

## Release checks still requiring owner configuration

- Apply migration 009 only after production backup and isolated restore rehearsal.
- Confirm real OAuth login and explicit linking with disposable accounts.
- Confirm actual inbox delivery, expired and reused links, password reset and
  session revocation. No provider secrets should appear in browser bundles/logs.
- Update privacy wording with actual sender/provider and retention settings.

References: [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect)
and [Resend email API](https://github.com/resend/resend-openapi/blob/main/resend.yaml).
