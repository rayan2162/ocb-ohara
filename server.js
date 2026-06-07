// OCS Ohara - read-only course library
// Lists every .json file inside courses/ and serves the page on port 3001.
const express = require('express');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const COURSES_DIR = path.join(ROOT, 'courses');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = process.env.PORT || 3001;

// Ensure the courses folder exists so a fresh clone still works.
if (!fs.existsSync(COURSES_DIR)) fs.mkdirSync(COURSES_DIR, { recursive: true });

// Defence-in-depth: every file lookup has to resolve inside COURSES_DIR.
function safeCoursePath(name) {
  if (typeof name !== 'string' || !name) {
    const err = new Error('Filename is required');
    err.status = 400;
    throw err;
  }
  // Disallow path separators, drive letters, and parent references in the
  // public filename. We re-join with COURSES_DIR and verify the resolved
  // path is still a child of COURSES_DIR below.
  if (/[\\/]|\.\./.test(name)) {
    const err = new Error('Invalid filename');
    err.status = 400;
    throw err;
  }
  const resolved = path.resolve(COURSES_DIR, name);
  const rootWithSep = COURSES_DIR.endsWith(path.sep) ? COURSES_DIR : COURSES_DIR + path.sep;
  if (resolved !== COURSES_DIR && !resolved.startsWith(rootWithSep)) {
    const err = new Error('Invalid filename');
    err.status = 400;
    throw err;
  }
  return resolved;
}

function safeFilenameBase(title, fallback) {
  return (title || fallback || 'course')
    .toString()
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || (fallback || 'course');
}

function readCourseFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (err) {
    const e = new Error(`File is not valid JSON: ${path.basename(filePath)}`);
    e.status = 500;
    throw e;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const e = new Error(`File is not a course object: ${path.basename(filePath)}`);
    e.status = 500;
    throw e;
  }
  return parsed;
}

function listAllCourses() {
  if (!fs.existsSync(COURSES_DIR)) return [];
  const entries = fs.readdirSync(COURSES_DIR, { withFileTypes: true });
  const courses = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
    if (entry.name.startsWith('.')) continue;
    const filePath = path.join(COURSES_DIR, entry.name);
    try {
      const data = readCourseFile(filePath);
      courses.push({
        filename: entry.name,
        // Surface the bits the UI cares about; fall back gracefully when fields
        // are missing so partial JSON files still show up.
        id: data.id || entry.name.replace(/\.json$/i, ''),
        title: data.title || entry.name.replace(/\.json$/i, ''),
        description: data.description || '',
        lessons: Array.isArray(data.lessons) ? data.lessons : [],
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
      });
    } catch (err) {
      console.error(`Skipping unreadable course file ${entry.name}:`, err.message);
    }
  }
  // Newest-updated first, matching the open-course-builder list ordering.
  courses.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return courses;
}

// --- App -------------------------------------------------------------------
const app = express();
app.use(express.static(PUBLIC_DIR));

// --- API -------------------------------------------------------------------
app.get('/api/courses', (_req, res) => {
  res.json(listAllCourses());
});

app.get('/api/courses/:filename', (req, res) => {
  let filePath;
  try { filePath = safeCoursePath(req.params.filename); }
  catch (err) { return res.status(err.status || 400).json({ error: err.message }); }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Course not found' });
  }
  try {
    const data = readCourseFile(filePath);
    res.json({ ...data, filename: path.basename(filePath) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/courses/:filename/download', (req, res) => {
  let filePath;
  try { filePath = safeCoursePath(req.params.filename); }
  catch (err) { return res.status(err.status || 400).json({ error: err.message }); }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Course not found' });
  }
  let course;
  try { course = readCourseFile(filePath); }
  catch (err) { return res.status(err.status || 500).json({ error: err.message }); }

  const base = safeFilenameBase(course.title, req.params.filename.replace(/\.json$/i, ''));
  const idPart = course.id ? `-${String(course.id).slice(0, 8)}` : '';
  const downloadName = `${base}${idPart}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  res.send(JSON.stringify(course, null, 2));
});

// --- Fallback to index.html for any non-API GET ----------------------------
app.get(/^\/(?!api).*/, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`OCS Ohara running at http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${PORT} is already in use.\n` +
        `  - Find the process:  netstat -ano | findstr :${PORT}\n` +
        `  - Kill it:           taskkill /PID <pid> /F\n` +
        `  - Or use a different port:  set PORT=3002  (cmd)  /  $env:PORT=3002  (powershell), then npm start\n`
    );
    process.exit(1);
  }
  throw err;
});
