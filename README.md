# KODC Dance & Fitness

Responsive, buildless HTML/CSS/JavaScript showcase with a browser-local studio editor. No framework, database, booking form, analytics, or server required.

## Run locally

From this repository: `python -m http.server 4173 --directory dist`, then open `http://localhost:4173/`. Use HTTP/HTTPS, not a file:// URL, because published content is loaded from JSON.

## GitHub Pages

In repository Settings → Pages, select **GitHub Actions** as the source. The included workflow deploys `dist/` on pushes to `main`. The intended address is https://remotekraft.github.io/KODC/.

The repository was private when implementation started. GitHub Pages availability for private repositories depends on the account plan ([GitHub documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)). Do not change repository visibility without the owner's approval. If Pages is unavailable, choose an eligible plan or a different approved host. A private source repository does not by itself mean the resulting Pages website is private. The workflow follows [GitHub's static deployment workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

If you later change domain or repository name, update the canonical URL, Open Graph URL, JSON-LD URL, sitemap, and robots references.

## Admin editor

Open `admin.html`. Initial convenience-login details were supplied privately in the handoff, not in this README. The password digest is in `dist/admin.js`. You can change the username and SHA-256 digest there.

**This is not secure authentication.** All frontend code is inspectable and the gate can be bypassed. It offers no protection for sensitive information and no authority to write to GitHub. The editor is for public showcase content only. A real secure admin/publish system requires an authenticated server or an authorized GitHub integration, even if no database is used.

The editor manages classes, days/timings, instructor assignments, featured/publish status, instructor biographies/photos, testimonials, and contact/social/review-snapshot details. Instructor images may be approved HTTPS URLs or committed `assets/` paths. No file-upload storage service is included.

### Publish an edit

1. Save the local draft in the admin editor.
2. Use **Preview local draft** to see it in this browser. The preview is visibly labelled and noindexed.
3. Click **Export content.json**. Unsaved form fields are not included.
4. Replace `dist/content.json` in the repository with that export and commit to `main`.
5. The Pages workflow deploys it. Every visitor then sees the published JSON.

Ordinary visitors **never read your local draft**. Drafts do not sync between devices or browsers; export backups before clearing storage. Import validates a complete KODC JSON file and asks before replacing a draft. Published content is the authoritative source; localStorage is only temporary editor state. The optional WebMCP tool reads a loaded draft; it does not publish.

Call and WhatsApp buttons initiate an enquiry, not a confirmed booking. No booking data is saved by this website. Google reviews and counts are a dated static snapshot, not an API/live feed. Google Fonts is an external stylesheet; local fallback fonts work if unavailable.

## Content checks before public launch

- Confirm current classes, fees, age groups, timetable, and instructor assignments. Initial timetable text intentionally requests an enquiry rather than inventing slots.
- Verify the sourced instructor's current KODC role; the initial profile explicitly describes public-profile evidence and does not assign class slots.
- Obtain client permission for the studio photos and testimonial publication, including any permissions needed for pictured participants. Replace photos with approved originals if needed.
- Recheck Google numbers when changing the review snapshot date.
- Update the schema/SEO contact fields if changing the studio identity. The client updates displayed contact information and runtime JSON-LD from content.json; the HTML fallback and meta description remain authored content.

See `RESEARCH.md` for source links and uncertainty notes.

## Checks

Run `node --check dist/content.js`, `node --check dist/app.js`, `node --check dist/admin.js`, and `node tests/content.test.cjs`. The Pages workflow runs these before deployment. Motion respects `prefers-reduced-motion`; navigation, filters, dialogs, and the editor support keyboards and touch.
