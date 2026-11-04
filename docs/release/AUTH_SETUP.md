# Account providers: deployment setup

Code supports password sessions, verification email and
single-use password reset. Providers remain off until configured. Do not publish
keys or apply production migrations without backup and release review.

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
- Confirm actual inbox delivery, expired and reused links, password reset and
  session revocation. No provider secrets should appear in browser bundles/logs.
- Update privacy wording with actual sender/provider and retention settings.

Reference: [Resend email API](https://github.com/resend/resend-openapi/blob/main/resend.yaml).

Google login/linking was withdrawn by the owner on 2026-11-04. No OAuth configuration is required.
