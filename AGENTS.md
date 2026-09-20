# Standing Rules

## Git Workflow & Push Policy

1. **Explicit Permission Required**:
   - **Do not merge and push** until explicitly instructed by the user.

2. **Sync Before Push or Feature Branch PR**:
   - Always pull / sync from `origin` before pushing, OR
   - Use a feature branch and create + merge a Pull Request (PR).

## Database Schema Changes & Migrations

For any schema changes, deploy them as Kubernetes Jobs in the target GitOps folder:
`C:\Users\user\Desktop\sv8-code\servicev8-devops`

### Key Requirements Enforced:

1. **Target Folder for GitOps Manifests**:
   - Write/update manifests in: `C:\Users\user\Desktop\sv8-code\servicev8-devops`

2. **Job Naming & ArgoCD Execution**:
   - Always bump the `-vN` suffix for Kubernetes Job names (e.g., `schema-migration-v1` -> `schema-migration-v2`) to ensure ArgoCD detects the change and re-executes the immutable Job resource.

3. **Git Commit & Push Policy**:
   - **Do not merge and push** until explicitly instructed by the user.
   - Always pull / sync from `origin` before pushing, or use a feature branch and create + merge a PR.
