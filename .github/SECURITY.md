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

Application sign-in JWTs expire after seven days; changing a password does not revoke already
issued tokens. During a suspected compromise, operators must consider token
invalidation, including coordinated signing-key rotation that logs everyone out.
Database cascades do not themselves remove files from local/S3 storage; operators
must account for stored files and backups when processing deletion requests.

AI reporting is optional and sends selected goal/activity text to the configured
Azure OpenAI endpoint when used. SMTP, Google OAuth, S3 and automation webhooks
introduce additional configured external services. Review these data flows before
using confidential information. This repository does not certify a deployment for
any particular regulatory or organizational security standard.

## MCP connections and AI data flow

MCP uses a separate OAuth authorization-code flow with S256 PKCE. Consent grants
access to one selected workspace, including all its projects: `mokpyo:read` is
selected by default, while `mokpyo:write` is optional when requested and permits
goal imports and subgoal additions. Membership, scope, expiry and revocation are
checked on MCP requests. Access tokens last one hour; rotating refresh tokens have
a fixed 30-day lifetime. These are separate from application sign-in JWTs.

Members can review and revoke their own connections under **Workspace settings →
My AI connections (MCP)**. Revoke an unwanted connection there; an access-token
expiry shown in the UI does not itself mean the connection has been revoked,
because a valid refresh token can renew access.

An authorized AI client retrieves workspace data and processes it under that
client's provider terms and data-handling settings. Revoking access prevents
further access through that connection; it does not erase data already retrieved
by the client. When importing from Jira or another service, the AI client connects
to that service separately. Mokpyo does not need its credentials or an AI-provider
API key for the MCP workflow. Review each connected service's permissions before
sharing confidential information.
