# Enable secure KODC admin publishing

Code is ready, but publishing remains disabled until YOU configure the runtime secrets. Do not send passwords or tokens in chat, screenshots, Git commits, or build logs.

## 1. Keep the existing Cloudflare build connection

Workers & Pages → **kodc** → Settings → Builds:

- Repository: `remotekraft/KODC`
- Production branch: `main`
- Root directory: `/`
- Build command: `node tests/content.test.cjs && node tests/worker.test.mjs` (recommended; replace the current empty command)
- Deploy command: `npx wrangler deploy` (unchanged)
- Version command: `npx wrangler versions upload` (unchanged)

The committed `wrangler.jsonc` deploys the existing Worker named `kodc`, serves `dist/`, and routes `/api/*` to the publishing code. It adds a native rate-limit binding (no KV, D1, R2, or database). Namespace `740031` is reserved here for this project's limiter; change it if your account already uses that namespace for another limiter.

## 2. Create a narrowly scoped GitHub token yourself

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token:

1. Choose the resource owner that owns `remotekraft/KODC`.
2. Repository access: **Only select repositories**, select **KODC** only.
3. Repository permissions: **Contents → Read and write**. Metadata read access is automatic. No Workflows permission is needed.
4. Set an expiry and a reminder to rotate the token. Complete any organization approval if GitHub requires it.
5. Copy the token directly into the Cloudflare secret below. Never put it in frontend JavaScript.

The publishing code can only update `dist/content.json` on `main` in this repository. Branch protection/repository rules may prevent direct commits; do not disable protections blindly. If your policy requires pull requests, this direct-publish flow needs adapting.

## 3. Add Worker RUNTIME secrets

Go to Workers & Pages → **kodc** → **Settings → Variables and Secrets**. This is the Worker's runtime section, **NOT** the Variables and secrets subsection inside Builds.

Add each with type **Secret**:

| Name | Value |
| --- | --- |
| `GITHUB_TOKEN` | The fine-grained token from step 2 |
| `ADMIN_PASSWORD` | A new unique password, 16–256 characters; use a password manager |
| `SESSION_SECRET` | A random signing key, at least 32 characters |

Generate `SESSION_SECRET` locally using `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, or use a password manager to generate a 64-character random value. Do not share it here. The previous publicly inspectable frontend login password is retired; **do not reuse it**.

Non-secret variables are already in `wrangler.jsonc`:

- `ADMIN_USERNAME`: `admin`
- `SITE_ORIGIN`: `https://kodc.remotekraft.workers.dev`

If using a custom domain, change `SITE_ORIGIN` in `wrangler.jsonc` to its exact HTTPS origin (no trailing slash/path), commit, and deploy. Admin APIs intentionally work only on that configured origin; preview URLs and the old GitHub Pages site cannot publish. Because Wrangler manages these non-secret variables, change them in the config rather than only editing the dashboard.

After adding secrets, deploy/redeploy the current version from Cloudflare so both the code and secrets are active. Verify the latest deployment succeeded. Missing secrets fail closed: public pages keep working, but admin displays a setup message. The existing Cloudflare **build API token** is unrelated to the GitHub content token; leave it alone.

## 4. Use the editor

Open **https://kodc.remotekraft.workers.dev/admin.html**:

1. Log in with `admin` and YOUR new `ADMIN_PASSWORD`.
2. Edit classes, timings, instructors, reviews, or contact details.
3. **Save changes** → optionally **Preview changes** → **Update website** → confirm.
4. A success message means GitHub accepted the content commit. Check Cloudflare's deployment status; visitors receive it after deployment succeeds. Publication is not instantaneous, and the editor does not claim a deployment has completed.

Draft save does not immediately publish, so unfinished changes never appear accidentally. Publish includes the entire saved draft, not unsaved form fields. You no longer need to export or commit manually; **Download backup** remains available as a safeguard.

Old browser drafts have no publishing revision. Export one as a backup, click **Get latest changes**, then restore the backup if desired, review the complete draft, save, and publish. If another editor publishes after your draft's baseline, GitHub rejects your stale revision. Export a backup, reload latest content, and manually reapply your edits; do not simply import an old complete file over somebody else's edits without reviewing it.

## Security and limitations

- Server-side credential checks; signed four-hour HttpOnly/Secure/SameSite=Strict session cookies; exact-origin and CSRF checks; content validation and 1 MB request limits; native login/publish rate limits.
- Secrets are encrypted runtime bindings; no tokens/passwords in site assets. Content remains public showcase data; never store student/payment/private records.
- One admin account. Logging out clears this browser's session cookie. To invalidate ALL issued sessions, rotate `SESSION_SECRET`; rotate it when changing a compromised password. Tokens expire after four hours; no database-backed per-session revocation.
- Native rate limiting is best-effort/local to Cloudflare locations, not a global lockout guarantee. Use a strong password; Cloudflare Access can add another layer if needed.
- No real GitHub token is exercised in automated tests. The owner must verify the first real publication and successful deployment after configuring secrets.
- A token expiry, rejected commit, build error, or Cloudflare quota can prevent publishing/deployment. Drafts and export backups remain available while logged in. If a publish request times out, check GitHub and Cloudflare before retrying; the commit may already exist.

Official references: [Cloudflare runtime secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [static asset routing](https://developers.cloudflare.com/workers/static-assets/binding/), [rate-limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [GitHub content API](https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28).
