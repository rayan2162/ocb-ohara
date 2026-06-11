// generate-index.js
// Walks ./courses/, reads every .json file, and writes ./courses-index.json
// with a slim summary for the static frontend. No npm dependencies — just
// `node generate-index.js` from the project root.
//
// The index is the only thing the browser fetches at load time. The original
// JSON files stay untouched in courses/ and are served directly by GitHub
// Pages, so "Download" links go straight to the on-disk file.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const COURSES_DIR = path.join(ROOT, 'courses');
const INDEX_FILE = path.join(ROOT, 'courses-index.json');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
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

function buildIndex() {
  if (!fs.existsSync(COURSES_DIR)) {
    console.error(`No courses/ directory at ${COURSES_DIR} — nothing to do.`);
    return [];
  }

  const entries = fs.readdirSync(COURSES_DIR, { withFileTypes: true });
  const courses = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
    if (entry.name.startsWith('.')) continue; // skip hidden / dotfiles

    const filePath = path.join(COURSES_DIR, entry.name);
    try {
      const data = readJson(filePath);
      const filename = entry.name;
      const fallbackTitle = filename.replace(/\.json$/i, '');

      const authors = Array.isArray(data.authors)
        ? data.authors
            .filter((a) => a && typeof a.authorName === 'string' && a.authorName.trim())
            .map((a) => ({
              authorName: a.authorName,
              authorLink: typeof a.authorLink === 'string' ? a.authorLink : '',
            }))
        : [];

      const tags = Array.isArray(data.tags)
        ? data.tags.filter((t) => typeof t === 'string')
        : [];

      const courseLanguage = Array.isArray(data.courseLanguage)
        ? data.courseLanguage.filter((l) => typeof l === 'string')
        : [];

      const lessonCount = Array.isArray(data.lessons) ? data.lessons.length : 0;

      courses.push({
        filename,
        title: typeof data.title === 'string' && data.title.trim() ? data.title : fallbackTitle,
        description: typeof data.description === 'string' ? data.description : '',
        tags,
        courseLanguage,
        authors,
        lessonCount,
        updatedAt: data.updatedAt || null,
      });
    } catch (err) {
      console.error(`Skipping unreadable course file ${entry.name}: ${err.message}`);
    }
  }

  // Newest-updated first, matching the previous server behaviour.
  courses.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return courses;
}

function main() {
  const courses = buildIndex();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(courses, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${courses.length} course${courses.length === 1 ? '' : 's'} to ${path.relative(ROOT, INDEX_FILE) || 'courses-index.json'}`);
}

main();
