# KODC Dance & Fitness

Responsive HTML/CSS/JavaScript showcase with a Cloudflare Worker-backed secure studio editor. No framework, database, booking form, or analytics. Public pages are static; authenticated publishing uses the Worker.

## Run locally

For public-page previews: `python -m http.server 4173 --directory dist`, then open `http://localhost:4173/`. Use HTTP/HTTPS, not a file:// URL, because published content is loaded from JSON. Secure admin publishing requires the configured production Cloudflare Worker; it deliberately does not fall back to a frontend password gate on static previews.

## Cloudflare hosting and secure publishing

The production Worker is https://kodc.remotekraft.workers.dev. Existing build settings (`main`, repository root, `npx wrangler deploy`) are supported by `wrangler.jsonc`. **Follow [CLOUDFLARE-SETUP.md](CLOUDFLARE-SETUP.md) to add runtime secrets and activate publishing.** Until configured, the public website continues working and admin fails closed with a setup message. GitHub credentials and admin passwords are never put in frontend assets.

## GitHub Pages

In repository Settings → Pages, select **GitHub Actions** as the source. The included workflow deploys `dist/` on pushes to `main`. The intended address is https://remotekraft.github.io/KODC/.

The repository was private when implementation started. GitHub Pages availability for private repositories depends on the account plan ([GitHub documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)). Do not change repository visibility without the owner's approval. If Pages is unavailable, choose an eligible plan or a different approved host. A private source repository does not by itself mean the resulting Pages website is private. The workflow follows [GitHub's static deployment workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

If you later change domain or repository name, update the canonical URL, Open Graph URL, JSON-LD URL, sitemap, and robots references.

Use only `.github/workflows/pages.yml`. A duplicate generic static workflow that uploaded the repository root caused `/admin.html` and the homepage to return 404 while `/dist/admin.html` worked; that competing workflow has been removed. The correct admin URL is https://remotekraft.github.io/KODC/admin.html. Legacy `/dist/` links now redirect to the correct pages.

## Video and motion

The performance section loads the requested YouTube video only after clicking Play, using YouTube's privacy-enhanced embed. Playback remains subject to YouTube availability and the video's embedding permissions; an external watch link is always available. No video file is downloaded or hosted here.

Motion includes staggered entrances, scroll reveals, class-filter transitions, hover effects, a scroll progress bar, an animated dance illustration, and a CC0 dancing GIF. The footer's Pause animations control persists in this browser and hides the GIF (GIF frames cannot be paused with CSS). Reduced-motion preferences disable decorative motion and hide the GIF. Artwork credits and generation details are in `RESEARCH.md`.

## Admin editor

Open `admin.html` on the configured Cloudflare origin. Username defaults to `admin`; the owner sets a NEW password as the encrypted `ADMIN_PASSWORD` runtime secret. The old client-side password/digest and sessionStorage login gate have been removed.

The Worker checks credentials server-side, issues a signed expiring HttpOnly cookie, checks exact request origin and CSRF tokens, rate-limits login/publishing, validates content, and only writes `dist/content.json` to `remotekraft/KODC` on `main`. The editor is for public showcase content only, never sensitive student/payment data. A static GitHub Pages copy cannot authenticate or publish.

The editor manages classes, days/timings, instructor assignments, featured/publish status, instructor biographies/photos, testimonials, and contact/social/review-snapshot details. Instructor images may be approved HTTPS URLs or committed `assets/` paths. No file-upload storage service is included.

### Publish an edit

1. Save the local draft in the admin editor.
2. Use **Preview local draft** to see it in this browser. The preview is visibly labelled and noindexed.
3. Click **Publish website** and confirm. Unsaved form fields must be saved or cancelled first.
4. The Worker commits the complete saved content file to GitHub automatically. No manual commit needed.
5. Cloudflare builds and deploys the commit. Every visitor sees it only after that deployment succeeds. GitHub Pages may also deploy the static public copy.

Ordinary visitors **never read your local draft**. Drafts do not sync between devices or browsers; export backups before clearing storage. Import validates a complete KODC JSON file and asks before replacing a draft. Repository revisions prevent stale drafts silently overwriting newer commits. Published content is the authoritative source; localStorage is only temporary editor state. Export remains available as a backup/manual recovery path. See the setup guide for legacy-draft migration and conflict recovery. The optional WebMCP tool reads a loaded draft; it does not publish.

Call and WhatsApp buttons initiate an enquiry, not a confirmed booking. No booking data is saved by this website. Google reviews and counts are a dated static snapshot, not an API/live feed. Google Fonts is an external stylesheet; local fallback fonts work if unavailable.

## Content checks before public launch

- Confirm current classes, fees, age groups, timetable, and instructor assignments. Initial timetable text intentionally requests an enquiry rather than inventing slots.
- Verify the sourced instructor's current KODC role; the initial profile explicitly describes public-profile evidence and does not assign class slots.
- Obtain client permission for the studio photos and testimonial publication, including any permissions needed for pictured participants. Replace photos with approved originals if needed.
- Recheck Google numbers when changing the review snapshot date.
- Update the schema/SEO contact fields if changing the studio identity. The client updates displayed contact information and runtime JSON-LD from content.json; the HTML fallback and meta description remain authored content.

See `RESEARCH.md` for source links and uncertainty notes.

## Checks

Run `node --check dist/content.js`, `node --check dist/app.js`, `node --check dist/admin.js`, `node --check worker/index.mjs`, `node tests/content.test.cjs`, and `node tests/worker.test.mjs`. The Pages workflow runs these before deployment. Worker tests use mocked GitHub responses and never publish real content. Motion respects `prefers-reduced-motion`; navigation, filters, dialogs, and the editor support keyboards and touch.
