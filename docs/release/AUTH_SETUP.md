# Authentication

Current scope: email/password registration, login, logout and existing session/CSRF
protection. Registration requires a valid email, display name and a password of
12–128 characters; confirmation and visibility controls are in the UI. No Google,
verification email, recovery email or password-change extension is active.
No mail-provider configuration is needed for the current authentication flow.

Owner requested this rollback on 2026-11-04. Existing accounts are preserved;
applied migration history is retained. Earlier provider instructions are archived
in [email-auth history](../archive/AUTH_EMAIL_HISTORY.md) and must not be used as
current setup instructions.
