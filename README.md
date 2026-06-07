# OCS Ohara

A read-only course library. Browse a list of courses and download any course as a JSON file. Visually mirrors the [`open-course-builder`](../open-course-builder) project, but is intentionally limited to **view + download** — no editing, no uploading, no auth.

## Run it

```bash
npm install
npm start
```

The server listens on **http://localhost:3001** by default (port `3000` is left free for `open-course-builder`). To use a different port:

```bash
PORT=4000 npm start   # macOS / Linux
$env:PORT=4000; npm start   # PowerShell
```

If port `3001` is already taken, the server will print a hint with the exact command to free the port.

## Project layout

```
ocs-ohara/
  server.js              # Express server, read-only API on port 3001
  package.json
  public/                # Static frontend (served at /)
    index.html
    main.js
    styles.css
  courses/               # JSON course files, one per course
    welcome-to-ohara.json
```

## Add a new course

Drop a `.json` file into the `courses/` folder and refresh the page. The minimal shape the UI understands is:

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

`title`, `description`, and `lessons` are optional — the UI falls back to safe defaults. Files that fail to parse are skipped with a console warning so a single bad file does not take the library down.

## API

| Method | Path                              | Description                                  |
| ------ | --------------------------------- | -------------------------------------------- |
| GET    | `/api/courses`                    | List of all courses with summary metadata.  |
| GET    | `/api/courses/:filename`          | Full JSON for a single course.               |
| GET    | `/api/courses/:filename/download` | Streams the file with `Content-Disposition`. |

`:filename` must be a plain file name (no `/`, `\`, or `..`). Requests that try to escape the `courses/` directory get a 400.