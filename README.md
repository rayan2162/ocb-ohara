# OCS Ohara

A read-only course library that runs as a fully static site — no server, no build step, no auth. Browse a list of courses and download any course as a JSON file. Designed to be deployed straight to **GitHub Pages** (or any static host: Netlify, S3, `python -m http.server`, …).

The JSON files in this catalog are **wire-compatible** with [`open-course-builder`](https://github.com/rayan2162/open-course-builder): a course you download here can be re-imported there with no transformation, and the file schema round-trips cleanly.

> Visually mirrors the `open-course-builder` project, but is intentionally limited to **view + download** — no editing, no uploading, no auth.

---

## Table of contents

- [Quick start (5 minutes)](#quick-start-5-minutes)
- [Live demo](#live-demo)
- [Features](#features)
- [How it works](#how-it-works)
- [Project layout](#project-layout)
- [Course schema](#course-schema)
  - [Top-level fields](#top-level-fields)
  - [Authors](#authors)
  - [Lessons](#lessons)
  - [Tags and language](#tags-and-language)
  - [Tasks](#tasks)
- [The `courses-index.json` index file](#the-courses-indexjson-index-file)
- [Add a new course](#add-a-new-course)
- [Use a downloaded course in `open-course-builder`](#use-a-downloaded-course-in-open-course-builder)
- [Deploy to GitHub Pages](#deploy-to-github-pages)
- [Local preview](#local-preview)
- [Filename safety and security model](#filename-safety-and-security-model)
- [Error handling and edge cases](#error-handling-and-edge-cases)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Quick start (5 minutes)

1. **Clone the repo**
   ```bash
   git clone https://github.com/rayan2162/ocb-ohara.git
   cd ocb-ohara
   ```

2. **Generate the index** (one-time per new course)
   ```bash
   node generate-index.js
   ```
   No `npm install` is required — the indexer has zero dependencies and uses only the Node built-ins `fs` and `path`.

3. **Open the site**
   - Easiest: double-click `index.html`. It runs as a `file://` page and fetches `./courses-index.json` + `./courses/*.json` directly.
   - Or serve the folder with anything static, e.g. `python -m http.server 8080`, then visit <http://localhost:8080/>.

4. **Refresh the index whenever you add or change a course file** — re-run `node generate-index.js` and commit the regenerated `courses-index.json` alongside the new course file.

That's it. The whole runtime is one self-contained `index.html` (inline CSS + inline JS + Bootstrap + Bootstrap Icons from a CDN).

---

## Live demo

Deployed to GitHub Pages at: **<https://rayan2162.github.io/ocb-ohara/>**

(Or whatever your `https://<user>.github.io/<repo>/` resolves to once Pages is enabled in the repo settings.)

---

## Features

| Area              | What you get                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| **Browse**        | Responsive card grid (1/2/3 columns at sm/md/lg) with title, description, lesson count, tags, language, authors, last-updated chip, and the on-disk filename chip. |
| **Search**        | Client-side filter across title, description, tags, `courseLanguage`, and `authorName`. Live count of matching courses. |
| **View**          | Bootstrap modal with a **List** view (lessons rendered as cards with type, content, notes) and a **Raw** view (pretty-printed JSON). Toggle in-place. |
| **Download**      | One click downloads the original `.json` file exactly as it lives in `courses/`. The browser uses the natural download flow. |
| **Mobile**        | Works on phones — cards stack, modal scrolls, chips wrap.                                       |
| **No backend**    | Pure static: no Node runtime in production, no Express, no auth tokens, no databases.            |
| **Round-trip**    | A downloaded course imports cleanly into `open-course-builder` (same schema, same field names).  |
| **Resilient**     | One malformed course file never breaks the catalog — it's logged and skipped at build time.     |

---

## How it works

```
       ┌──────────────────────────┐
       │   courses/*.json         │   ← you author or drop these in
       │   (source of truth)      │
       └────────────┬─────────────┘
                    │
                    │  node generate-index.js
                    │  (walks ./courses/, parses each file)
                    ▼
       ┌──────────────────────────┐
       │   courses-index.json     │   ← slim manifest, sorted by updatedAt desc
       │   (generated; committed) │
       └────────────┬─────────────┘
                    │
                    │  fetched at page load
                    ▼
       ┌──────────────────────────┐
       │   index.html             │   ← single self-contained page
       │   (inline CSS + JS +     │     renders the grid, opens the modal,
       │    Bootstrap + Icons)    │     and serves individual course files
       └──────────────────────────┘
```

- **Build time** is just `node generate-index.js`. There is no bundler, no transpiler, no watcher.
- **Runtime** is whatever serves static files. GitHub Pages is the primary target.
- **No data is stored in a database** — `courses/*.json` *is* the database. Add, edit, or delete a file; regenerate the index; push.

---

## Project layout

```
ocb-ohara/
├── index.html            # Self-contained: inline CSS + inline JS + Bootstrap CDN
├── generate-index.js     # Build-time indexer (no npm dependencies)
├── courses-index.json    # Generated manifest; consumed by index.html
├── package.json          # Convenience scripts: `npm run build` and `npm start`
└── courses/
    └── *.json            # Source course files (one per course, served as-is)
```

The `npm` scripts are aliases for `node generate-index.js`:

```bash
npm run build     # same as: node generate-index.js
npm start         # same as: node generate-index.js
```

They exist so the build step is discoverable from `package.json` and works the same on every platform.

---

## Course schema

Every file in `courses/` is a single JSON object. The shape is **identical to what `open-course-builder` writes to its `db/<uuid>.json` store**, so the two projects stay in lock-step.

### Top-level fields

| Field            | Type     | Required | Notes                                                                                  |
| ---------------- | -------- | -------- | -------------------------------------------------------------------------------------- |
| `id`             | string   | yes      | Stable identifier (typically a UUID). Surfaced in the UI and the download URL.         |
| `title`          | string   | yes      | Card title and `<h1>`. Falls back to the filename (without `.json`) if missing.        |
| `description`    | string   | no       | Card subtitle. Empty string is rendered as *“No description”*.                         |
| `lessons`        | array    | no       | Ordered list of lesson objects (see below). Defaults to `[]`.                           |
| `authors`        | array    | no       | List of author entries (see below). Defaults to `[]`.                                  |
| `tags`           | string[] | no       | Free-form chips, e.g. `["js", "react"]`. Surfaced in the search haystack.              |
| `courseLanguage` | string[] | no       | Language chips, e.g. `["english", "bangla"]`. Surfaced in the search haystack.          |
| `tasks`          | array    | no       | Optional tasks/questions for learners (see below).                                     |
| `createdAt`      | string   | no       | ISO-8601 timestamp.                                                                    |
| `updatedAt`      | string   | no       | ISO-8601 timestamp. Drives the sort order of the catalog.                              |

Any extra fields are preserved verbatim on download — only the list view (`courses-index.json`) projects a known subset.

### Authors

```json
"authors": [
  { "authorName": "Jane Doe", "authorLink": "https://janedoe.dev" }
]
```

| Field        | Type   | Notes                                                                                  |
| ------------ | ------ | -------------------------------------------------------------------------------------- |
| `authorName` | string | Display label. **Required in practice** — entries without it are dropped from the UI. |
| `authorLink` | string | Optional. When present, the author chip becomes a link (`target="_blank"`, `rel="noopener noreferrer"`). |

Each author is rendered as a small purple chip in its own labeled block on the card. Clicking a chip does **not** open the course modal.

### Lessons

```json
"lessons": [
  {
    "id": "c5bdec74-a3e1-4915-859a-89e1699ba425",
    "title": "Lesson name",
    "type": "text",
    "content": "Lesson body — supports plain text or markdown depending on `type`.",
    "resource": "",
    "notes": "",
    "lessonNote": "",
    "isCompleted": false,
    "completeDate": null,
    "createdAt": "2026-06-10T11:24:55.074Z"
  }
]
```

| Field          | Type             | Notes                                                                                                          |
| -------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `id`           | string           | Stable per-lesson identifier.                                                                                  |
| `title`        | string           | Lesson header in the modal.                                                                                    |
| `type`         | string           | One of `text`, `link`, or `markdown`. Drives how `content` / `resource` is rendered.                           |
| `content`      | string           | Body. For `type: "link"`, this is usually empty and `resource` carries the URL.                                |
| `resource`     | string           | URL for `type: "link"` lessons. Rendered as a clickable button.                                                |
| `notes`        | string           | Optional short note attached to the lesson.                                                                    |
| `lessonNote`   | string           | Optional long-form note.                                                                                       |
| `isCompleted`  | boolean          | Progress flag.                                                                                                  |
| `completeDate` | string \| null   | ISO-8601 timestamp, or `null` while in progress.                                                               |
| `createdAt`    | string           | ISO-8601 timestamp.                                                                                            |

The modal **List** view renders each lesson as a card with its type, body, and an external link button when applicable. The **Raw** view shows the same data as pretty-printed JSON.

### Tags and language

```json
"tags": ["js", "react", "node"],
"courseLanguage": ["english", "bangla"]
```

Both default to `[]` and render as small gray chips. They're also part of the client-side search haystack, so a course will match a query against its tags and language as well as its title and description.

### Tasks

```json
"tasks": [
  {
    "id": "51ed1a65-8dbf-40ad-ae07-43184ba728bf",
    "title": "Task title",
    "question": "Task question is here",
    "instruction": "LLM/system instruction will go here",
    "createdAt": "2026-06-10T11:25:14.567Z",
    "submissions": []
  }
]
```

Tasks are preserved verbatim on download but are not rendered in this static catalog's UI. They're stored alongside the course for round-tripping with `open-course-builder`, which does display them.

---

## The `courses-index.json` index file

`courses-index.json` is the **only build artifact** of this site. It is generated by `generate-index.js` and consumed by `index.html` on page load. Commit it alongside your course files so GitHub Pages (which serves a static snapshot) can see the latest list.

Shape:

```json
[
  {
    "filename": "e79c6c29-136b-4572-b208-7ec9b475b1c0.json",
    "title": "Intro to Ohara",
    "description": "…",
    "tags": ["fundamentals"],
    "courseLanguage": ["en"],
    "authors": [{ "authorName": "Jane Doe", "authorLink": "https://…" }],
    "lessonCount": 4,
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

Build rules (in `generate-index.js`):

- Walks `./courses/` and reads every non-hidden `.json` file.
- Hidden files (names starting with `.`) are skipped.
- Files that fail to parse are logged to the console and skipped — they never break the build.
- Entries without an `authorName` are dropped from `authors`.
- `tags` and `courseLanguage` default to `[]` if missing.
- `lessonCount` is `lessons.length` when `lessons` is an array, else `0`.
- Entries are sorted by `updatedAt` **descending** (newest first); courses with a missing date sink to the bottom, falling back to filename order.

---

## Add a new course

1. Drop a `.json` file into `courses/`. The filename is used as the on-disk identifier and becomes part of the download URL, so UUIDs are fine (`e79c6c29-136b-4572-b208-7ec9b475b1c0.json`).
2. Match the [Course schema](#course-schema). The minimal shape the UI understands:
   ```json
   {
     "id": "my-course",
     "title": "My Course",
     "description": "What learners will get out of this course.",
     "lessons": [
       { "id": "lesson-1", "title": "Lesson 1", "type": "text", "content": "..." }
     ],
     "createdAt": "2024-01-15T10:00:00.000Z",
     "updatedAt": "2024-01-20T15:30:00.000Z"
   }
   ```
3. Regenerate the index:
   ```bash
   node generate-index.js
   ```
4. Commit both files and push:
   ```bash
   git add courses/my-course.json courses-index.json
   git commit -m "Add my-course"
   git push
   ```

Hidden files (names starting with `.`) and non-`.json` files are ignored by both the indexer and the page.

---

## Use a downloaded course in `open-course-builder`

The two projects share an exact JSON shape, so a course downloaded from this catalog imports cleanly into `open-course-builder`:

1. In this catalog, click **Download** on any course card. The browser saves the original `.json` file.
2. In `open-course-builder`, use its **Import** feature and pick that file.
3. The course appears with all its lessons, authors, tags, language, and tasks intact.

Conversely, a course exported from `open-course-builder`'s `db/<uuid>.json` store can be dropped straight into this repo's `courses/` folder — re-run the indexer and it'll show up in the catalog.

---

## Deploy to GitHub Pages

1. Make sure `courses-index.json` is up to date:
   ```bash
   node generate-index.js
   git add courses-index.json
   git commit -m "Refresh index"
   ```
2. Push to `main`:
   ```bash
   git push origin main
   ```
3. In the GitHub repo → **Settings** → **Pages**:
   - **Source:** *Deploy from a branch*
   - **Branch:** `main`
   - **Folder:** `/ (root)`
4. Save. GitHub will build the Pages site (usually under a minute) and the catalog will be live at:
   ```
   https://<your-github-username>.github.io/ocb-ohara/
   ```

There is no `gh-pages` branch, no `_config.yml`, no build action — `index.html` lives at the repo root and reads `courses-index.json` + `courses/*.json` as sibling paths.

**Custom domain?** Drop a `CNAME` file at the repo root containing your domain, then point DNS at GitHub's Pages servers per their docs.

---

## Local preview

You can preview the site without deploying it, and without `npm install`:

```bash
# Python 3 (no install needed if you have Python)
python -m http.server 8080

# or any other static server
npx http-server -p 8080
```

Then open <http://localhost:8080/>. The page will fetch `courses-index.json` and individual `courses/*.json` files over HTTP, which is the same code path GitHub Pages uses.

> **Tip:** Double-clicking `index.html` also works for a quick peek — modern browsers happily fetch local JSON files for an `http://` or `file://` page. A local server is only required if you run into CORS quirks with your specific browser.

---

## Filename safety and security model

Because this site is fully static, there is **no server-side input** to validate. The only paths that ever get resolved are the ones you put on disk in `courses/`. That keeps the security model intentionally small:

- The indexer **skips** filenames starting with `.` (hidden files).
- The indexer **skips** non-`.json` files.
- The indexer **catches** parse errors and logs them; a malformed file never breaks the build.
- The download flow is a plain `<a href="courses/<filename>" download>`. The browser fetches a file that already exists on disk — there is no path-traversal vector because nothing resolves user input.
- The full original JSON is shipped to the client when a course is opened. Don't put secrets in a course file; this catalog is a public surface by design.

If you ever add a server in front of this site, follow the same rules used in the now-removed Express build:

- Reject any `:filename` containing `/`, `\`, or `..` with `400`.
- Resolve the path against `courses/` with `path.resolve` and confirm the result is still under `courses/`.
- Re-parse the file as JSON before responding.

---

## Error handling and edge cases

- **Malformed course file** — logged to the console by `generate-index.js` and skipped. The catalog is built from the remaining valid files.
- **No courses yet** — the page renders an explicit empty state ("No courses found") with a hint to run `node generate-index.js` or drop a file in `courses/`.
- **Search returns no results** — same empty-state element, with a "matching …" suffix in the count.
- **Failed network request** — a Bootstrap toast in the bottom-right corner surfaces the error, and an explicit "Failed to load courses" state replaces the grid.
- **Empty `lessons` / `authors` / `tags` / `courseLanguage`** — the UI hides those blocks instead of showing empty chips.
- **Missing `id` / `title` / `description` / `updatedAt`** — the indexer and the page both fall back gracefully (filename for `id`/`title`, empty string for `description`, filename order for sorting).

---

## Troubleshooting

**The page shows "Failed to load courses".**
Open the browser DevTools → Network tab. The `courses-index.json` request will show the exact error. Common causes:
- You opened the page from a path where the relative `./courses-index.json` URL can't resolve.
- You haven't run `node generate-index.js` yet, or the file got deleted.
- A CORS quirk with `file://` in your specific browser — switch to `python -m http.server 8080` to test.

**A course I added isn't showing up.**
- Did you re-run `node generate-index.js` after dropping the file?
- Is the file actually a `.json` file (not `.json.txt` or a hidden `.foo.json`)?
- Is the JSON valid? `node -e "JSON.parse(require('fs').readFileSync('courses/your-file.json','utf8'))"` will tell you.
- Did you commit the regenerated `courses-index.json`?

**The download button gives me a UUID filename, not a pretty one.**
That's intentional in static mode: the browser uses the on-disk filename (typically a UUID) for the download. The catalog doesn't rewrite the `Content-Disposition` header because there's no server to rewrite it. If you need a pretty name, rename the file in `courses/` before regenerating the index.

**The site looks unstyled.**
The page depends on `bootstrap@5.3.3` and `bootstrap-icons@1.11.3` from a CDN. If you're offline or the CDN is blocked, the grid will still work but the modal/cards will look bare. Self-host the assets and update the `<link>` / `<script>` tags in `index.html` if you need full offline support.

---

## License

MIT — see `LICENSE` if/when added, or treat the source as MIT-licensed by default.
