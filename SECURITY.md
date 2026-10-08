# Security

## Private reports

Please send potential vulnerabilities to [contact@alexsoft.co.kr](mailto:contact@alexsoft.co.kr)
with the subject `Mokpyo security report`. Include the affected version, prerequisites,
impact and a minimal reproduction using synthetic data. Do not post credentials,
private customer data or an unpatched vulnerability in public issues.

Reports and fixes are handled on a best-effort basis. There is no guaranteed response
time, bounty or long-term support commitment for older releases.

## Deployment responsibilities

Mokpyo is self-hosted software. Operators manage accounts, network exposure, HTTPS,
secrets, database access, backups, retention and incident response. Back up both
PostgreSQL and file storage and test their restoration together. Review migrations
against a backup before upgrading an existing installation.

Workspace membership is the access boundary. Separate private projects within a
workspace are not currently an access-control feature. Use separate workspaces
when groups must not see each other's goals.

Current JWTs expire after seven days; changing a password does not revoke already
issued tokens. During a suspected compromise, operators must consider token
invalidation, including coordinated signing-key rotation that logs everyone out.
Database cascades do not themselves remove files from local/S3 storage; operators
must account for stored files and backups when processing deletion requests.

AI reporting is optional and sends selected goal/activity text to the configured
Azure OpenAI endpoint when used. SMTP, Google OAuth, S3 and automation webhooks
introduce additional configured external services. Review these data flows before
using confidential information. This repository does not certify a deployment for
any particular regulatory or organizational security standard.
