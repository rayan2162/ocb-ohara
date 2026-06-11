# OCS Ohara

A read-only course library. Browse a list of courses and download any course as a JSON file. Visually mirrors the [`open-course-builder`](../open-course-builder) project, but is intentionally limited to **view + download** — no editing, no uploading, no auth.

The server reads every `.json` file in the `courses/` folder on disk, surfaces a summary list to the browser, and streams a pretty-printed copy of the original file (with a sanitised `Content-Disposition` filename) when a user clicks **Download**.

---

## Table of contents

- [OCS Ohara](#ocs-ohara)
  - [Table of contents](#table-of-contents)
  - [Run it](#run-it)
  - [Project layout](#project-layout)
  - [How it works](#how-it-works)
  - [Add a new course](#add-a-new-course)
  - [Course schema](#course-schema)
    - [Authors on the card](#authors-on-the-card)
    - [Author entry shape](#author-entry-shape)
  - [API](#api)
  - [Frontend](#frontend)
  - [Filename safety and security model](#filename-safety-and-security-model)
  - [Download filename behavior](#download-filename-behavior)
  - [Error handling](#error-handling)
  - [Troubleshooting](#troubleshooting)

---

## Run it

```bash
npm install
npm start
```

The server listens on **http://localhost:3001** by default (port `3000` is left free for `open-course-builder`). To use a different port:

```bash
PORT=4000 npm start                        # macOS / Linux
$env:PORT=4000; npm start                  # PowerShell
set PORT=4000 && npm start                 # cmd.exe
```

The `start` and `dev` scripts are identical (`node server.js`); there is no watcher — restart the process after editing server-side code.

The server auto-creates an empty `courses/` directory on first start so a fresh clone still works.

If port `3001` is already taken, the server prints a hint with the exact `netstat` / `taskkill` / `PORT=` commands to free it (see [Troubleshooting](#troubleshooting)).

## Project layout

```
ocs-ohara/
  server.js              # Express server, read-only API on port 3001 (PORT env)
  package.json
  public/                # Static frontend (served at /)
    index.html           # Layout: navbar, course grid, view modal, toast
    main.js              # Fetch list, render cards, open modal, trigger downloads
    styles.css           # Card + chip styling layered on top of Bootstrap
  courses/               # JSON course files, one per course (auto-created)
    welcome-to-ohara.json
```

Runtime dependencies: **express ^4.19.2**. No build step, no transpilation, no client framework — the UI is plain DOM + Bootstrap 5 (loaded from a CDN).

## How it works

1. On boot, `server.js` ensures `courses/` exists and registers three routes plus a catch-all that serves `index.html` for any non-API GET.
2. `GET /api/courses` reads the directory synchronously, parses every non-hidden `.json` file, and returns a slim summary for each (`id`, `title`, `description`, `lessons`, `authors`, `createdAt`, `updatedAt`, `filename`). Bad files are logged and skipped so one broken file cannot take the library down. The list is sorted by `updatedAt` descending (newest first); ties fall back to filename order.
3. The browser fetches the list, renders a responsive card grid (Bootstrap columns: `col-12 col-md-6 col-lg-4`), and lets the user either **View** the JSON in a modal or **Download** a pretty-printed copy.
4. Download requests stream the JSON back with a `Content-Disposition: attachment; filename="…"` header. The server derives the download filename from the course's `title` (and prefixes a short slice of the `id` for uniqueness), so users get a readable file name instead of the on-disk UUID.

## Add a new course

Drop a `.json` file into the `courses/` folder and refresh the page. Hidden files (those starting with `.`) and non-`.json` files are ignored. The minimal shape the UI understands is:

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

## Course schema

The reader falls back gracefully when fields are missing:

- `id` / `title` → derived from the filename (without `.json`).
- `description` → empty string (the card shows *“No description”*).
- `lessons` → `[]` (the lesson badge shows `0`).
- `authors` → `[]` (the author block is hidden).
- `createdAt` / `updatedAt` → `null` (the updated chip is hidden; the list falls back to filename order).

A richer course with authors, tags, language, and tasks:

```json
{
  "id": "cb56dd8e-1c59-421c-8056-5e6a2e82c7ef",
  "title": "test author",
  "description": "this is course description",
  "createdAt": "2026-06-10T10:49:22.133Z",
  "updatedAt": "2026-06-10T11:25:14.567Z",
  "lessons": [
    {
      "id": "c5bdec74-a3e1-4915-859a-89e1699ba425",
      "title": "lesson name",
      "type": "link",
      "resource": "https://linkedin.com/in/rayanul-kader-chowdhury",
      "notes": "",
      "lessonNote": "",
      "isCompleted": false,
      "completeDate": null,
      "createdAt": "2026-06-10T11:24:55.074Z"
    }
  ],
  "authors": [
    { "authorName": "rayanr", "authorLink": "https://linkedin.com/in/rayanul-kader-chowdhury" },
    { "authorName": "rayan",  "authorLink": "https://linkedin.com/in/rayanul-kader-chowdhury" }
  ],
  "tags": ["js", "react", "node"],
  "courseLanguage": ["english", "bangla"],
  "tasks": [
    {
      "id": "51ed1a65-8dbf-40ad-ae07-43184ba728bf",
      "title": "task",
      "question": "task question is here",
      "instruction": "llms instuction will go here",
      "createdAt": "2026-06-10T11:25:14.567Z",
      "submissions": []
    }
  ]
}
```

The API **returns the full original object** for a single course (`GET /api/courses/:filename`) — including any extra fields you add. Only the **list view** (`GET /api/courses`) projects a known subset, so unrelated data is not shipped in the list payload.

### Authors on the card

When a course has an `authors` array, each entry is rendered as a small purple chip in its own labeled block (*“Authors”* with a people icon). Authors with an `authorLink` become clickable links (`target="_blank"`, `rel="noopener noreferrer"`); entries without a link are plain chips. Author chips stop click propagation so they do not open the course modal. The full list of author names is also exposed via the block's `title` tooltip.

### Author entry shape

| Field        | Type    | Notes                                                                 |
| ------------ | ------- | --------------------------------------------------------------------- |
| `authorName` | string  | Display label. Required in practice — entries without it are dropped. |
| `authorLink` | string  | Optional. When present, the chip becomes a link to that URL.          |

## API

| Method | Path                              | Description                                                                                 |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------- |
| GET    | `/api/courses`                    | List of all courses with summary metadata (`id`, `title`, `description`, `lessons`, `authors`, `createdAt`, `updatedAt`, `filename`). |
| GET    | `/api/courses/:filename`          | Full JSON object for a single course, with the original `filename` added.                  |
| GET    | `/api/courses/:filename/download` | Streams a pretty-printed JSON copy with `Content-Disposition: attachment; filename="…"`.   |

`:filename` must be a plain file name — no `/`, `\`, `..`, or other path tricks. See [Filename safety](#filename-safety-and-security-model).

All error responses are JSON: `{ "error": "message" }`.

## Frontend

`public/main.js` is a single IIFE that:

- Fetches `/api/courses` on load and renders the grid.
- Renders each card with: title, description (or *“No description”*), lesson-count badge, authors block (only when there are any), filename chip, updated chip, and **View** / **Download** buttons.
- Opens the view modal on card click and shows the full pretty-printed JSON plus a *Download JSON* button that re-uses the per-card download endpoint.
- Triggers downloads by creating a temporary `<a href="/api/courses/…/download">` and clicking it; the server's `Content-Disposition` header supplies the filename.
- Surfaces API failures via a Bootstrap toast in the bottom-right corner.

CDN assets (no bundler needed):

- `bootstrap@5.3.3` — layout, grid, modal, toast.
- `bootstrap-icons@1.11.3` — icon set.

The catch-all route `app.get(/^\/(?!api).*/, …)` serves `index.html` for any non-`/api/*` GET, so deep links and would-be client-side routes degrade to the SPA shell.

## Filename safety and security model

Every `:filename` route goes through `safeCoursePath()`:

1. The raw param is rejected if it contains `/`, `\`, or `..` (400).
2. The remaining name is resolved against `courses/` with `path.resolve`.
3. The resolved path must equal `courses/` or start with `courses/` + `path.sep`. Otherwise 400.
4. The file is then checked with `fs.existsSync` (404 if missing) and re-parsed with `readCourseFile()`, which throws if the JSON is malformed or the root is not a plain object.

The download endpoint additionally calls `safeFilenameBase()` to scrub the output filename (see below).

## Download filename behavior

The `Content-Disposition` filename is built from the course's `title` (or the on-disk filename if missing), sanitised through `safeFilenameBase()`:

- Lower/upper case letters, digits, dot, underscore, and hyphen are kept.
- Everything else (including spaces) collapses to a single `-`.
- Leading/trailing `-` are trimmed.
- Truncated to 60 characters.
- Falls back to `course` if the result is empty.

If the course has an `id`, the first 8 characters are appended with a `-` separator, so two courses with identical titles still produce distinct downloads. The extension is always `.json`.

Examples:

| `title`     | `id`         | Download filename           |
| ----------- | ------------ | --------------------------- |
| `My Course` | `my-course`  | `My-Course-my-cours.json`   |
| `!!!`       | *(none)*     | `course.json`               |
| `データ`     | `abc123…`    | `-abc12345.json`            |

## Error handling

- **Bad JSON in a course file** — logged to the server console (`Skipping unreadable course file …`) and excluded from the list. Single-file errors never break the rest of the library.
- **404** — `Course not found` when the file does not exist.
- **400** — `Invalid filename` for path-traversal attempts; `Filename is required` for empty params.
- **500** — `File is not valid JSON` / `File is not a course object` for files that exist but cannot be parsed.
- **Port in use** — the server prints the exact `netstat` / `taskkill` / `PORT=` commands to free it and exits with code 1.

## Troubleshooting

**`Port 3001 is already in use.`** — The server prints a hint with the exact commands. On Windows PowerShell:

```powershell
netstat -ano | findstr :3001
taskkill /PID <pid> /F
```

Or pick another port: `$env:PORT=3002; npm start`.

**`Failed to load courses: …` toast** — open DevTools → Network. The `/api/courses` request will show the exact error. Common causes: port already in use, a non-`.json` file in `courses/` that confused an earlier version, or a server that wasn't restarted after editing `server.js`.

**Course card shows no authors** — confirm the JSON has an `authors` array at the top level (not nested under another key) and that each entry has an `authorName`. Entries without a name are dropped silently.

**The page refreshes to a blank screen on a deep link** — the catch-all route serves `index.html` for any non-`/api/*` GET, so client-side routes would work if you added a router. As shipped, all navigation stays on `/`.

## Static mode (GitHub Pages)

The project also ships a fully static build with **no server runtime**. Everything Express used to do is folded into a build-time indexer and a self-contained `index.html`.

### What changes

| | Express mode | Static mode |
| --- | --- | --- |
| Runtime | `node server.js` (Express) | None — pure static files |
| Course list source | `GET /api/courses` (live `fs.readdir`) | `./courses-index.json` (generated) |
| Course detail source | `GET /api/courses/:filename` | Direct fetch of `courses/<filename>` |
| Download | `GET /api/courses/:filename/download` (with `Content-Disposition`) | Plain `<a href="courses/…" download>` |
| Search | None (all courses listed) | Client-side filter on title, description, tags, `courseLanguage`, `authorName` |
| Hosting | Anywhere Node runs | GitHub Pages, Netlify, S3, `python -m http.server`, etc. |

### Files for static mode

```
ocs-ohara/
├── index.html            # Self-contained: inline CSS + inline JS + Bootstrap CDN
├── generate-index.js     # Build-time indexer (no npm deps)
├── courses-index.json    # Generated; consumed by index.html
└── courses/
    └── *.json            # Source course files (served as-is)
```

The old `server.js` and `public/` are still on disk for the Express path but are **not** used in static mode.

### Build the index

From the repo root:

```bash
node generate-index.js
```

The script walks `./courses/`, reads every non-hidden `.json` file, and writes `./courses-index.json` with a slim entry per course:

```json
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
```

Notes:

- Hidden files (names starting with `.`) are skipped.
- Files that fail to parse are logged and skipped, never breaking the build.
- Entries without an `authorName` are dropped from `authors`.
- `tags` and `courseLanguage` default to `[]` if missing.
- `lessonCount` is `lessons.length` if `lessons` is an array, else `0`.
- Entries are sorted by `updatedAt` descending (missing dates sink to the bottom).

The list endpoint in Express mode returns the same shape, so the static and dynamic paths stay in lock-step.

### Deploy to GitHub Pages

1. Run `node generate-index.js` and commit the resulting `courses-index.json`.
2. Push to `main`.
3. In the repo settings → **Pages**, set the source to **Deploy from a branch** → `main` → `/ (root)`.
4. Wait for the Pages build. The site is now served at `https://<user>.github.io/<repo>/`.

No build step, no `_config.yml`, no `gh-pages` branch — `index.html` lives at the repo root and reads `courses-index.json` and `courses/*.json` as sibling paths.

### Refreshing after adding a course

```bash
# 1. drop your file
cp my-new-course.json courses/

# 2. rebuild the index
node generate-index.js

# 3. commit both the course file and the regenerated index
git add courses/my-new-course.json courses-index.json
git commit -m "Add my new course"
git push
```

GitHub Pages will pick up the new commit on the next deploy cycle (usually under a minute).

### Local preview

You can preview the static site without Node at all:

```bash
# Python 3
python -m http.server 8080

# or, if you have any other static server
npx http-server -p 8080
```

Then open <http://localhost:8080/>. The page will fetch `courses-index.json` and individual `courses/*.json` files over HTTP, which is the same code path GitHub Pages uses.

### Why `download` works as a plain link

In static mode the **Download** button is a real `<a href="courses/<filename>" download>`. The browser streams the original file from disk with its existing filename and `application/json` MIME. The Express version's `Content-Disposition` rewrite is no longer needed because there's no server to rewrite anything. The trade-off: download filenames use the on-disk UUID-based name, not the prettified `title-id` form the server produced.