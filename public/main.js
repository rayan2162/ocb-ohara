// OCS Ohara - frontend
(() => {
  'use strict';

  // ---------- State --------------------------------------------------------
  const state = {
    courses: [],
  };

  // ---------- DOM refs -----------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const els = {
    courseCount: $('#courseCount'),
    emptyState: $('#emptyState'),
    coursesList: $('#coursesList'),

    courseModalEl: $('#courseModal'),
    courseModalTitle: $('#courseModalTitle'),
    courseModalMeta: $('#courseModalMeta'),
    courseModalDescription: $('#courseModalDescription'),
    courseModalJson: $('#courseModalJson'),
    courseModalDownloadBtn: $('#courseModalDownloadBtn'),

    toastEl: $('#toast'),
    toastBody: $('#toastBody'),
  };

  const bs = {
    courseModal: new bootstrap.Modal(els.courseModalEl),
    toast: new bootstrap.Toast(els.toastEl, { delay: 2500 }),
  };

  // Track the course currently open in the modal so the download button
  // knows which endpoint to hit without re-reading the DOM.
  let activeCourse = null;

  // ---------- Helpers ------------------------------------------------------
  function toast(msg) {
    els.toastBody.textContent = msg;
    bs.toast.show();
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  async function api(method, url) {
    const res = await fetch(url, { method, headers: {} });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  }

  // ---------- Courses list -------------------------------------------------
  async function loadCourses() {
    try {
      state.courses = await api('GET', '/api/courses');
      renderCourses();
    } catch (err) {
      toast('Failed to load courses: ' + err.message);
    }
  }

  function renderCourses() {
    const list = state.courses;
    els.courseCount.textContent = list.length ? `${list.length} course${list.length === 1 ? '' : 's'}` : '';

    if (!list.length) {
      els.emptyState.classList.remove('d-none');
      els.coursesList.innerHTML = '';
      return;
    }
    els.emptyState.classList.add('d-none');

    els.coursesList.innerHTML = list
      .map((c) => {
        const lessons = Array.isArray(c.lessons) ? c.lessons : [];
        const lessonsCount = lessons.length;
        const updated = c.updatedAt ? formatDate(c.updatedAt) : '';
        return `
          <div class="col-12 col-md-6 col-lg-4">
            <div class="course-card" data-filename="${escapeHtml(c.filename)}">
              <div class="course-card-head">
                <div class="course-card-head-text">
                  <h5 class="mb-1">${escapeHtml(c.title)}</h5>
                  ${c.description
                    ? `<p class="course-card-desc">${escapeHtml(c.description)}</p>`
                    : `<p class="course-card-desc is-muted">No description</p>`}
                </div>
                <div class="course-card-head-actions">
                  <div class="course-card-lesson-badge" title="Total lessons" aria-label="${lessonsCount} lessons">
                    <i class="bi bi-collection"></i>
                    <span>${lessonsCount}</span>
                  </div>
                </div>
              </div>
              <div class="course-card-stats">
                <span class="stat-chip stat-total" title="File on disk">
                  <i class="bi bi-file-earmark-code"></i>${escapeHtml(c.filename)}
                </span>
                ${updated
                  ? `<span class="stat-chip stat-updated" title="Last updated">
                       <i class="bi bi-calendar3"></i>${escapeHtml(updated)}
                     </span>`
                  : ''}
              </div>
              <div class="course-card-footer">
                <button type="button" class="btn btn-sm btn-outline-secondary view-course">
                  <i class="bi bi-eye"></i> View
                </button>
                <button type="button" class="btn btn-sm btn-primary download-course">
                  <i class="bi bi-download"></i> Download
                </button>
              </div>
            </div>
          </div>`;
      })
      .join('');

    $$('.course-card').forEach((el) => {
      const filename = el.dataset.filename;
      el.querySelector('.view-course').addEventListener('click', (e) => {
        e.stopPropagation();
        openCourse(filename);
      });
      el.querySelector('.download-course').addEventListener('click', (e) => {
        e.stopPropagation();
        downloadCourse(filename);
      });
      el.addEventListener('click', () => openCourse(filename));
    });
  }

  // ---------- Course modal ------------------------------------------------
  async function openCourse(filename) {
    try {
      const course = await api('GET', `/api/courses/${encodeURIComponent(filename)}`);
      activeCourse = { filename, course };
      els.courseModalTitle.textContent = course.title || filename;
      const lessons = Array.isArray(course.lessons) ? course.lessons.length : 0;
      const updated = course.updatedAt ? formatDate(course.updatedAt) : '—';
      els.courseModalMeta.textContent = `${lessons} lesson${lessons === 1 ? '' : 's'} · updated ${updated} · ${filename}`;
      els.courseModalDescription.textContent = course.description || '';
      els.courseModalDescription.classList.toggle('text-muted', !course.description);
      els.courseModalJson.textContent = JSON.stringify(course, null, 2);
      bs.courseModal.show();
    } catch (err) {
      toast('Failed to open course: ' + err.message);
    }
  }

  // Clicking "Download JSON" inside the modal still calls the same endpoint
  // as the per-card button, so both paths use the server's Content-Disposition
  // filename (which already sanitises the title).
  function modalDownload() {
    if (!activeCourse) return;
    downloadCourse(activeCourse.filename);
  }

  // Browser-side helper: hit the download endpoint in a way that triggers
  // the file save dialog. We do a regular navigation so the server can set
  // Content-Disposition; the browser does the rest.
  function downloadCourse(filename) {
    const url = `/api/courses/${encodeURIComponent(filename)}/download`;
    const a = document.createElement('a');
    a.href = url;
    // No `download` attribute needed: the server's Content-Disposition
    // header tells the browser the filename, and we still want the request
    // to work even if a misconfigured browser ignores the attribute.
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---------- Init --------------------------------------------------------
  function init() {
    els.courseModalDownloadBtn.addEventListener('click', modalDownload);
    loadCourses();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
