# Security

This is a student MVP, not a production financial service. Use synthetic data only.
Never commit .env or supply secrets through a public issue, screenshot or log.

For a vulnerability, contact the repository owner privately through an available
GitHub private vulnerability report or private contact channel. Do not disclose
personal data, tokens or exploit details in public issues. If no private channel
is configured, request one without publishing sensitive details. No response-time
or supported-version guarantee is offered.

See docs/THREAT_MODEL.md and docs/PRIVACY.md for boundaries and limitations.
Run npm audit and review the actual advisory tree; never use audit fix --force
blindly. Development-tool moderate advisories remain tracked in docs/BACKLOG.md.
Before public deployment verify HTTPS/proxy topology, secrets, backup/log retention
and infrastructure permissions. RLS is not currently enabled.
