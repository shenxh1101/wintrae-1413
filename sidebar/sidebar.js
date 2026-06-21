import {
  getCourses,
  getChapters,
  getNotes,
  getPlans,
  deleteChapter,
  deleteCourse,
  saveChapter,
  saveCourse,
  savePlan,
  saveNote,
  deleteNote,
  deletePlan,
  getStreak,
  getLastOpened,
  formatTime,
  formatDate,
  formatDateTime,
  getRelativeDate,
  isOverdue,
  isToday,
  calculateProgress,
  estimateDuration,
  formatDuration,
  PLATFORMS,
  getDaysDiff,
  getTodayKey,
  generateId
} from '../common/utils.js';

const STATE = {
  activeTab: 'courses',
  searchQuery: '',
  statusFilter: 'all',
  platformFilter: [],
  tagFilter: [],
  expandedCourses: new Set(),
  courses: [],
  chapters: [],
  notes: [],
  plans: [],
  streaks: { current: 0, longest: 0, lastDate: null }
};

document.addEventListener('DOMContentLoaded', async () => {
  await init();
});

async function init() {
  await loadAllData();
  setupTabs();
  setupSearch();
  setupFilters();
  setupResumeButton();
  renderAll();
}

async function loadAllData() {
  [STATE.courses, STATE.chapters, STATE.notes, STATE.plans, STATE.streaks] = await Promise.all([
    getCourses(),
    getChapters(),
    getNotes(),
    getPlans(),
    getStreak()
  ]);
}

function renderAll() {
  renderStreak();
  renderPlatformFilters();
  renderTagFilters();
  renderCourseList();
  renderPlanner();
  renderNotes();
  renderReminders();
}

function setupTabs() {
  document.querySelectorAll('#mainTabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#mainTabs .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      STATE.activeTab = tab.dataset.tab;
    });
  });
}

function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      STATE.searchQuery = e.target.value.toLowerCase();
      renderCourseList();
      renderNotes();
    }, 200);
  });
}

function setupFilters() {
  document.querySelectorAll('#filterChips .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#filterChips .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      STATE.statusFilter = chip.dataset.filter;
      renderCourseList();
    });
  });
}

function setupResumeButton() {
  document.getElementById('resumeBtn').addEventListener('click', async () => {
    const last = await getLastOpened();
    if (last && last.url) {
      chrome.runtime.sendMessage({
        type: 'OPEN_CHAPTER',
        payload: { url: last.url, position: last.position }
      });
    } else {
      alert('还没有学习记录');
    }
  });
}

function renderStreak() {
  document.getElementById('streakCount').textContent = STATE.streaks.current || 0;
}

function renderPlatformFilters() {
  const container = document.getElementById('platformFilter');
  const usedPlatforms = new Set(STATE.courses.map(c => c.platform));
  const platforms = Object.entries(PLATFORMS).filter(([key]) => usedPlatforms.has(key));
  
  if (platforms.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = platforms.map(([key, val]) => {
    const active = STATE.platformFilter.includes(key);
    return `<button class="platform-chip ${active ? 'active' : ''}" data-platform="${key}">
      <span class="dot" style="background:${val.color}"></span>
      ${val.name}
    </button>`;
  }).join('');

  container.querySelectorAll('.platform-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const platform = chip.dataset.platform;
      const idx = STATE.platformFilter.indexOf(platform);
      if (idx >= 0) {
        STATE.platformFilter.splice(idx, 1);
      } else {
        STATE.platformFilter.push(platform);
      }
      renderPlatformFilters();
      renderCourseList();
    });
  });
}

function renderTagFilters() {
  const container = document.getElementById('tagFilter');
  const allTags = new Set();
  STATE.courses.forEach(c => {
    (c.tags || []).forEach(t => allTags.add(t));
  });

  if (allTags.size === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  const sortedTags = Array.from(allTags).sort();
  container.innerHTML = sortedTags.map(tag => {
    const active = STATE.tagFilter.includes(tag);
    return `<button class="tag-chip ${active ? 'active' : ''}" data-tag="${escapeAttr(tag)}">
      🏷 ${escapeHtml(tag)}
    </button>`;
  }).join('');

  container.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      const idx = STATE.tagFilter.indexOf(tag);
      if (idx >= 0) {
        STATE.tagFilter.splice(idx, 1);
      } else {
        STATE.tagFilter.push(tag);
      }
      renderTagFilters();
      renderCourseList();
    });
  });
}

function getFilteredCourses() {
  let courses = [...STATE.courses];

  if (STATE.platformFilter.length > 0) {
    courses = courses.filter(c => STATE.platformFilter.includes(c.platform));
  }

  if (STATE.tagFilter.length > 0) {
    courses = courses.filter(c => {
      const courseTags = c.tags || [];
      return STATE.tagFilter.some(t => courseTags.includes(t));
    });
  }

  if (STATE.searchQuery) {
    courses = courses.filter(c => {
      if (c.name.toLowerCase().includes(STATE.searchQuery)) return true;
      if ((c.tags || []).some(t => t.toLowerCase().includes(STATE.searchQuery))) return true;
      const chapters = STATE.chapters.filter(ch => ch.courseId === c.id);
      return chapters.some(ch => ch.name.toLowerCase().includes(STATE.searchQuery));
    });
  }

  return courses.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function getFilteredChapters(courseId) {
  let chapters = STATE.chapters.filter(c => c.courseId === courseId);

  switch (STATE.statusFilter) {
    case 'inprogress':
      chapters = chapters.filter(c => !c.completed);
      break;
    case 'completed':
      chapters = chapters.filter(c => c.completed);
      break;
    case 'overdue':
      chapters = chapters.filter(c => !c.completed && isOverdue(c.dueDate));
      break;
  }

  if (STATE.searchQuery) {
    chapters = chapters.filter(c => c.name.toLowerCase().includes(STATE.searchQuery));
  }

  return chapters.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

function renderCourseList() {
  const container = document.getElementById('courseList');
  const courses = getFilteredCourses();

  if (courses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📖</div>
        <div class="empty-state-text">${STATE.searchQuery || STATE.platformFilter.length > 0 || STATE.tagFilter.length > 0 || STATE.statusFilter !== 'all' ? '没有符合条件的课程' : '还没有保存的课程<br>在课程页面点击右下角按钮开始记录'}</div>
      </div>
    `;
    return;
  }

  container.innerHTML = courses.map(course => {
    const chapters = getFilteredChapters(course.id);
    const allChapters = STATE.chapters.filter(c => c.courseId === course.id);
    const completedCount = allChapters.filter(c => c.completed).length;
    const platform = PLATFORMS[course.platform] || PLATFORMS.other;
    const totalProgress = allChapters.length > 0
      ? Math.round((completedCount / allChapters.length) * 100)
      : 0;
    const expanded = STATE.expandedCourses.has(course.id);
    const courseTags = (course.tags || []).slice(0, 5);

    return `
      <div class="course-card ${expanded ? 'expanded' : ''}" data-course-id="${course.id}">
        <div class="course-card-header">
          <div class="course-platform" style="background:${platform.color}"></div>
          <div class="course-info">
            <div class="course-name" title="${escapeHtml(course.name)}">${escapeHtml(course.name)}</div>
            <div class="course-meta">
              <span>${platform.name}</span>
              <span>·</span>
              <span>${allChapters.length}节</span>
              <span>·</span>
              <span>${completedCount}/${allChapters.length}已完成</span>
            </div>
            ${courseTags.length > 0 ? `
              <div class="course-tags">
                ${courseTags.map(t => `<span class="course-tag">🏷 ${escapeHtml(t)}</span>`).join('')}
              </div>
            ` : ''}
            <div class="course-progress mt-2">
              <div class="course-progress-bar">
                <div class="course-progress-fill" style="width:${totalProgress}%"></div>
              </div>
              <div class="course-progress-text">学习进度 ${totalProgress}%</div>
            </div>
          </div>
          <div class="flex flex-col items-center gap-1">
            <div class="course-actions">
              <button class="course-action-btn" data-action="edit-course" title="编辑课程">✏️</button>
              <button class="course-action-btn" data-action="delete-course" title="删除课程">🗑️</button>
            </div>
            <span class="expand-icon">▶</span>
          </div>
        </div>
        <div class="chapter-list">
          ${chapters.length === 0 
            ? `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px">没有符合条件的章节</div>`
            : chapters.map(chapter => renderChapterItem(chapter)).join('')
          }
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.course-card-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.course-action-btn')) return;
      const card = header.closest('.course-card');
      const courseId = card.dataset.courseId;
      if (STATE.expandedCourses.has(courseId)) {
        STATE.expandedCourses.delete(courseId);
      } else {
        STATE.expandedCourses.add(courseId);
      }
      renderCourseList();
    });
  });

  container.querySelectorAll('.course-action-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = btn.closest('.course-card');
      const courseId = card.dataset.courseId;
      const action = btn.dataset.action;

      if (action === 'edit-course') {
        showEditCourseModal(courseId);
      } else if (action === 'delete-course') {
        if (confirm('确定要删除这个课程及其所有章节和笔记吗？')) {
          await deleteCourse(courseId);
          STATE.expandedCourses.delete(courseId);
          await loadAllData();
          renderAll();
        }
      }
    });
  });

  container.querySelectorAll('.chapter-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.closest('.chapter-action-btn')) return;
      const chapterId = item.dataset.chapterId;
      const chapter = STATE.chapters.find(c => c.id === chapterId);
      if (chapter) {
        await chrome.runtime.sendMessage({
          type: 'OPEN_CHAPTER',
          payload: { url: chapter.url, position: chapter.position }
        });
      }
    });
  });

  container.querySelectorAll('.chapter-action-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const item = btn.closest('.chapter-item');
      const chapterId = item.dataset.chapterId;
      const action = btn.dataset.action;

      if (action === 'toggle') {
        const chapter = STATE.chapters.find(c => c.id === chapterId);
        if (chapter) {
          chapter.completed = !chapter.completed;
          await saveChapter(chapter);
          await loadAllData();
          renderAll();
        }
      } else if (action === 'edit') {
        showEditChapterModal(chapterId);
      } else if (action === 'delete') {
        if (confirm('确定删除此章节？相关笔记也会被删除。')) {
          await deleteChapter(chapterId);
          await loadAllData();
          renderAll();
        }
      }
    });
  });
}

function renderChapterItem(chapter) {
  const progress = chapter.duration ? calculateProgress(chapter.position, chapter.duration) : 0;
  const overdue = !chapter.completed && isOverdue(chapter.dueDate);
  const today = !chapter.completed && isToday(chapter.dueDate);
  
  const metaParts = [];
  metaParts.push(`${formatTime(chapter.position)} / ${formatTime(chapter.duration || 0)}`);
  if (chapter.dueDate) {
    metaParts.push(`<span class="chapter-due ${overdue ? 'overdue' : ''} ${today ? 'today' : ''}">📅 ${getRelativeDate(chapter.dueDate)}</span>`);
  }
  if (progress >= 100) {
    metaParts.push('<span style="color:var(--success)">✓ 已学完</span>');
  }

  return `
    <div class="chapter-item" data-chapter-id="${chapter.id}">
      <div class="chapter-status ${chapter.completed ? 'completed' : ''}" data-action="toggle"></div>
      <div class="chapter-content">
        <div class="chapter-title" title="${escapeHtml(chapter.name)}">${escapeHtml(chapter.name)}</div>
        <div class="chapter-meta">
          ${metaParts.join(' · ')}
          <div class="chapter-progress-bar" title="学习进度 ${progress}%">
            <div class="chapter-progress-fill" style="width:${Math.min(100, progress)}%"></div>
          </div>
        </div>
      </div>
      <div class="chapter-actions">
        <button class="chapter-action-btn" data-action="toggle" title="${chapter.completed ? '标记为未完成' : '标记为已完成'}">${chapter.completed ? '↩️' : '✓'}</button>
        <button class="chapter-action-btn" data-action="edit" title="编辑">✏️</button>
        <button class="chapter-action-btn" data-action="delete" title="删除">🗑️</button>
      </div>
    </div>
  `;
}

function showEditCourseModal(courseId) {
  const course = STATE.courses.find(c => c.id === courseId);
  if (!course) return;

  const body = `
    <div class="edit-form">
      <div class="form-group">
        <label class="form-label">课程名称</label>
        <input type="text" class="input" id="edit-course-name" value="${escapeAttr(course.name)}">
      </div>
      <div class="form-group">
        <label class="form-label">平台</label>
        <select class="input" id="edit-course-platform">
          ${Object.entries(PLATFORMS).map(([key, val]) => 
            `<option value="${key}" ${course.platform === key ? 'selected' : ''}>${val.name}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">标签</label>
        <input type="text" class="input" id="edit-course-tags" value="${escapeAttr((course.tags || []).join(', '))}" placeholder="用逗号分隔">
      </div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" id="modal-cancel">取消</button>
    <button class="btn btn-primary" id="modal-save">保存</button>
  `;

  showModal({ title: '编辑课程', body, footer });

  document.getElementById('modal-cancel').onclick = closeModal;
  document.getElementById('modal-save').onclick = async () => {
    course.name = document.getElementById('edit-course-name').value.trim();
    course.platform = document.getElementById('edit-course-platform').value;
    course.tags = document.getElementById('edit-course-tags').value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    if (!course.name) {
      alert('请输入课程名称');
      return;
    }
    await saveCourse(course);
    closeModal();
    await loadAllData();
    renderAll();
  };
}

function showEditChapterModal(chapterId) {
  const chapter = STATE.chapters.find(c => c.id === chapterId);
  if (!chapter) return;

  const body = `
    <div class="edit-form">
      <div class="form-group">
        <label class="form-label">章节名称</label>
        <input type="text" class="input" id="edit-chapter-name" value="${escapeAttr(chapter.name)}">
      </div>
      <div class="form-row flex gap-2" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="form-group">
          <label class="form-label">当前位置</label>
          <input type="text" class="input" id="edit-chapter-position" value="${formatTime(chapter.position)}">
        </div>
        <div class="form-group">
          <label class="form-label">总时长</label>
          <input type="text" class="input" id="edit-chapter-duration" value="${formatTime(chapter.duration || 0)}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">截止日期</label>
        <input type="date" class="input" id="edit-chapter-duedate" value="${chapter.dueDate || ''}">
      </div>
      <div class="form-group">
        <label class="st-checkbox">
          <input type="checkbox" id="edit-chapter-completed" ${chapter.completed ? 'checked' : ''}>
          <span>标记为已完成</span>
        </label>
      </div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" id="modal-cancel">取消</button>
    <button class="btn btn-primary" id="modal-save">保存</button>
  `;

  showModal({ title: '编辑章节', body, footer });

  document.getElementById('modal-cancel').onclick = closeModal;
  document.getElementById('modal-save').onclick = async () => {
    chapter.name = document.getElementById('edit-chapter-name').value.trim();
    chapter.position = parseTimeStr(document.getElementById('edit-chapter-position').value);
    chapter.duration = parseTimeStr(document.getElementById('edit-chapter-duration').value) || null;
    chapter.dueDate = document.getElementById('edit-chapter-duedate').value || null;
    chapter.completed = document.getElementById('edit-chapter-completed').checked;
    if (!chapter.name) {
      alert('请输入章节名称');
      return;
    }
    await saveChapter(chapter);
    closeModal();
    await loadAllData();
    renderAll();
  };
}

function parseTimeStr(str) {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function showModal({ title, body, footer }) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">${title}</div>
          <button class="close-btn" id="modalClose">&times;</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    </div>
  `;
  document.getElementById('modalClose').onclick = closeModal;
  document.getElementById('modalOverlay').onclick = (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  };
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  if (!text) return '';
  return text.replace(/"/g, '&quot;');
}

function renderPlanner() {
  const container = document.getElementById('plannerContainer');
  const incomplete = STATE.chapters.filter(c => !c.completed).sort((a, b) => {
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  const today = new Date();
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const dayPlans = {};
  days.forEach(d => {
    const key = d.toISOString().split('T')[0];
    dayPlans[key] = STATE.plans.filter(p => p.date === key);
  });

  const dailyTarget = calcDailyTarget();

  container.innerHTML = `
    <div class="planner-container" style="display:flex;flex-direction:column;height:100%;overflow:hidden">
      <div class="planner-stats" style="padding:12px 16px;background:var(--bg-primary);border-bottom:1px solid var(--border)">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          <div class="card" style="padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:700;color:var(--primary)">${incomplete.length}</div>
            <div style="font-size:11px;color:var(--text-muted)">待学章节</div>
          </div>
          <div class="card" style="padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:700;color:${incomplete.some(c => isOverdue(c.dueDate)) ? 'var(--danger)' : 'var(--success)'}">
              ${incomplete.filter(c => isOverdue(c.dueDate)).length}
            </div>
            <div style="font-size:11px;color:var(--text-muted)">已逾期</div>
          </div>
          <div class="card" style="padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:700;color:var(--info)">${formatDuration(dailyTarget)}</div>
            <div style="font-size:11px;color:var(--text-muted)">每日目标</div>
          </div>
        </div>
        <div style="margin-top:10px;font-size:11px;color:var(--text-muted);padding:0 4px">
          <span class="day-duration-ok">● 达标</span> &nbsp;
          <span class="day-duration-warning">● 接近目标(80%)</span> &nbsp;
          <span class="day-duration-over">● 超出目标</span>
        </div>
      </div>
      
      <div class="planner-content" style="display:flex;flex:1;overflow:hidden">
        <div class="chapter-pool" style="width:180px;border-right:1px solid var(--border);background:var(--bg-secondary);overflow-y:auto;padding:10px">
          <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;padding:0 4px">待排章节</div>
          ${incomplete.length === 0 
            ? '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px">所有章节已完成！</div>'
            : `<div id="chapterPool" style="display:flex;flex-direction:column;gap:6px">
              ${incomplete.map(ch => {
                const course = STATE.courses.find(c => c.id === ch.courseId);
                return `
                  <div class="chapter-draggable card" 
                       draggable="true" 
                       data-chapter-id="${ch.id}"
                       style="padding:8px;cursor:grab;font-size:12px">
                    <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(ch.name)}</div>
                    <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${formatDuration(ch.duration || 0)} ${ch.dueDate ? '· ' + getRelativeDate(ch.dueDate) : ''}</div>
                    <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${course ? escapeHtml(course.name) : ''}</div>
                  </div>
                `;
              }).join('')}
            </div>`
          }
        </div>
        
        <div class="calendar" style="flex:1;overflow-y:auto;padding:10px">
          <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:10px">两周日历（拖拽章节到日期中）</div>
          <div class="calendar-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px">
            ${days.map((d, idx) => {
              const key = d.toISOString().split('T')[0];
              const isToday = idx === 0;
              const plans = dayPlans[key] || [];
              const totalSeconds = plans.reduce((sum, p) => {
                const ch = STATE.chapters.find(c => c.id === p.chapterId);
                return sum + (ch?.duration || 0);
              }, 0);
              
              let durationClass = 'day-duration-ok';
              let dayClass = '';
              if (dailyTarget > 0) {
                const ratio = totalSeconds / dailyTarget;
                if (ratio > 1) {
                  durationClass = 'day-duration-over';
                  dayClass = 'over-target';
                } else if (ratio >= 0.8) {
                  durationClass = 'day-duration-warning';
                  dayClass = 'near-target';
                }
              }
              
              return `
                <div class="calendar-day card ${isToday ? 'today' : ''} ${dayClass}" 
                     data-date="${key}"
                     style="padding:8px;min-height:120px;${isToday ? 'border:2px solid var(--primary);' : ''}">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <span style="font-weight:600;font-size:13px">${d.getMonth() + 1}/${d.getDate()}</span>
                    <span style="font-size:10px;color:var(--text-muted)">${['日','一','二','三','四','五','六'][d.getDay()]}</span>
                  </div>
                  <div style="font-size:10px;margin-bottom:6px" class="${durationClass}">
                    ⏱ ${formatDuration(totalSeconds)}
                    ${dailyTarget > 0 ? ` <span style="opacity:0.7">/ ${formatDuration(dailyTarget)}</span>` : ''}
                    ${totalSeconds > dailyTarget && dailyTarget > 0 ? ' ⚠️' : ''}
                  </div>
                  <div class="day-plans" style="display:flex;flex-direction:column;gap:4px">
                    ${plans.map(p => {
                      const ch = STATE.chapters.find(c => c.id === p.chapterId);
                      if (!ch) return '';
                      return `
                        <div class="plan-item" style="padding:4px 6px;background:var(--bg-tertiary);border-radius:4px;font-size:11px;display:flex;justify-content:space-between;align-items:center;gap:4px">
                          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(ch.name)}">${escapeHtml(ch.name)}</span>
                          <button class="plan-delete" data-plan-id="${p.id}" style="border:none;background:none;cursor:pointer;color:var(--text-muted);font-size:12px;flex-shrink:0">×</button>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  setupDragAndDrop();

  container.querySelectorAll('.plan-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const planId = btn.dataset.planId;
      await deletePlan(planId);
      await loadAllData();
      renderPlanner();
    });
  });
}

function calcDailyTarget() {
  const incomplete = STATE.chapters.filter(c => !c.completed && c.duration);
  const today = new Date();
  let minDate = null;
  let totalSeconds = 0;

  incomplete.forEach(ch => {
    totalSeconds += ch.duration;
    if (ch.dueDate) {
      const d = new Date(ch.dueDate);
      if (!minDate || d < minDate) minDate = d;
    }
  });

  if (!minDate) {
    return totalSeconds > 0 ? Math.ceil(totalSeconds / 7) : 0;
  }

  const daysLeft = Math.max(1, getDaysDiff(today, minDate) + 1);
  return estimateDuration(totalSeconds, daysLeft);
}

function setupDragAndDrop() {
  let draggedChapterId = null;

  document.querySelectorAll('.chapter-draggable').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      draggedChapterId = el.dataset.chapterId;
      el.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => {
      el.style.opacity = '1';
    });
  });

  document.querySelectorAll('.calendar-day').forEach(day => {
    day.addEventListener('dragover', (e) => {
      e.preventDefault();
      day.style.background = 'var(--bg-tertiary)';
    });
    day.addEventListener('dragleave', () => {
      day.style.background = '';
    });
    day.addEventListener('drop', async (e) => {
      e.preventDefault();
      day.style.background = '';
      if (draggedChapterId) {
        const date = day.dataset.date;
        await savePlan({
          chapterId: draggedChapterId,
          date
        });
        draggedChapterId = null;
        await loadAllData();
        renderPlanner();
      }
    });
  });
}

function renderNotes() {
  const container = document.getElementById('notesContainer');
  let notes = [...STATE.notes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (STATE.searchQuery) {
    notes = notes.filter(n => 
      n.content.toLowerCase().includes(STATE.searchQuery) ||
      (n.chapterName && n.chapterName.toLowerCase().includes(STATE.searchQuery)) ||
      (n.tags && n.tags.some(t => t.toLowerCase().includes(STATE.searchQuery)))
    );
  }

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;overflow:hidden">
      <div style="padding:12px 16px;background:var(--bg-primary);border-bottom:1px solid var(--border);display:flex;gap:8px">
        <button class="filter-chip active" data-note-filter="all">全部 (${STATE.notes.length})</button>
        <button class="filter-chip" data-note-filter="review">待复习 (${STATE.notes.filter(n => n.needsReview).length})</button>
        <button class="filter-chip" data-note-filter="screenshot">截图 (${STATE.notes.filter(n => n.screenshot).length})</button>
      </div>
      <div class="notes-list scrollbar" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px">
        ${notes.length === 0 
          ? `<div class="empty-state">
              <div class="empty-state-icon">📝</div>
              <div class="empty-state-text">${STATE.searchQuery ? '没有匹配的笔记' : '还没有笔记<br>在视频页面点击按钮添加笔记'}</div>
            </div>`
          : notes.map(note => renderNoteCard(note)).join('')
        }
      </div>
    </div>
  `;

  container.querySelectorAll('[data-note-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-note-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.noteFilter;
      let filtered = [...STATE.notes];
      if (filter === 'review') filtered = filtered.filter(n => n.needsReview);
      if (filter === 'screenshot') filtered = filtered.filter(n => n.screenshot);
      if (STATE.searchQuery) {
        filtered = filtered.filter(n => 
          n.content.toLowerCase().includes(STATE.searchQuery) ||
          (n.chapterName && n.chapterName.toLowerCase().includes(STATE.searchQuery))
        );
      }
      filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      container.querySelector('.notes-list').innerHTML = filtered.length === 0
        ? `<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">没有符合条件的笔记</div></div>`
        : filtered.map(note => renderNoteCard(note)).join('');
      bindNoteEvents(container);
    });
  });

  bindNoteEvents(container);
}

function renderNoteCard(note) {
  const chapter = STATE.chapters.find(c => c.id === note.chapterId);

  return `
    <div class="card note-card" data-note-id="${note.id}">
      ${note.screenshot ? `
        <div style="margin:-12px -12px 10px;border-radius:8px 8px 0 0;overflow:hidden;background:#000">
          <img src="${note.screenshot}" style="width:100%;display:block;max-height:160px;object-fit:cover">
        </div>
      ` : ''}
      <div class="note-header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span class="badge badge-info">⏱ ${formatTime(note.timepoint)}</span>
          ${note.needsReview ? '<span class="badge badge-warning">待复习</span>' : ''}
          ${(note.tags || []).map(t => `<span class="tag tag-highlight">${escapeHtml(t)}</span>`).join('')}
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm btn-secondary note-toggle-review" title="${note.needsReview ? '取消待复习' : '标记待复习'}">${note.needsReview ? '✓' : '🔖'}</button>
          <button class="btn btn-sm btn-secondary note-delete" title="删除">🗑️</button>
        </div>
      </div>
      <div class="note-content" style="font-size:13px;color:var(--text-primary);line-height:1.6;white-space:pre-wrap;margin-bottom:8px">${escapeHtml(note.content)}</div>
      <div class="note-footer" style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--text-muted)">
        <span class="note-chapter-link" style="cursor:pointer;color:var(--primary)">📺 ${escapeHtml(note.chapterName || chapter?.name || '未知章节')}</span>
        <span>${formatDateTime(note.createdAt)}</span>
      </div>
    </div>
  `;
}

function bindNoteEvents(container) {
  container.querySelectorAll('.note-card').forEach(card => {
    const noteId = card.dataset.noteId;
    const note = STATE.notes.find(n => n.id === noteId);
    if (!note) return;

    card.querySelector('.note-delete').addEventListener('click', async () => {
      if (confirm('确定删除此笔记？')) {
        await deleteNote(noteId);
        await loadAllData();
        renderNotes();
      }
    });

    card.querySelector('.note-toggle-review').addEventListener('click', async () => {
      note.needsReview = !note.needsReview;
      await saveNote(note);
      await loadAllData();
      renderNotes();
    });

    card.querySelector('.note-chapter-link').addEventListener('click', async () => {
      if (note.url) {
        await chrome.runtime.sendMessage({
          type: 'OPEN_CHAPTER',
          payload: { url: note.url, position: note.timepoint }
        });
      }
    });
  });
}

function renderReminders() {
  const container = document.getElementById('remindersContainer');
  
  const overdue = STATE.chapters.filter(c => !c.completed && isOverdue(c.dueDate));
  const today = STATE.chapters.filter(c => !c.completed && isToday(c.dueDate));
  const upcoming = STATE.chapters.filter(c => {
    if (c.completed || !c.dueDate) return false;
    const diff = getDaysDiff(new Date(), new Date(c.dueDate));
    return diff > 0 && diff <= 7;
  }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const reviewNotes = STATE.notes.filter(n => n.needsReview);

  container.innerHTML = `
    <div class="reminders scrollbar" style="height:100%;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:16px">
      <div class="streak-card card" style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:none">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:48px">🔥</div>
          <div>
            <div style="font-size:28px;font-weight:800;color:#92400e">${STATE.streaks.current}天</div>
            <div style="font-size:12px;color:#92400e;opacity:0.8">连续学习</div>
          </div>
          <div style="flex:1"></div>
          <div style="text-align:right">
            <div style="font-size:14px;font-weight:600;color:#92400e">最佳 ${STATE.streaks.longest}天</div>
          </div>
        </div>
      </div>

      ${overdue.length > 0 ? `
        <div class="reminder-section">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:0 4px">
            <span style="color:var(--danger)">⚠️</span>
            <span style="font-weight:600;font-size:14px;color:var(--danger)">已逾期 (${overdue.length})</span>
          </div>
          ${overdue.map(ch => renderReminderItem(ch, 'danger')).join('')}
        </div>
      ` : ''}

      ${today.length > 0 ? `
        <div class="reminder-section">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:0 4px">
            <span>📌</span>
            <span style="font-weight:600;font-size:14px">今日任务 (${today.length})</span>
          </div>
          ${today.map(ch => renderReminderItem(ch, 'warning')).join('')}
        </div>
      ` : ''}

      ${upcoming.length > 0 ? `
        <div class="reminder-section">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:0 4px">
            <span>📅</span>
            <span style="font-weight:600;font-size:14px;color:var(--text-secondary)">即将到期 (${upcoming.length})</span>
          </div>
          ${upcoming.map(ch => renderReminderItem(ch, 'info')).join('')}
        </div>
      ` : ''}

      ${reviewNotes.length > 0 ? `
        <div class="reminder-section">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:0 4px">
            <span>📝</span>
            <span style="font-weight:600;font-size:14px;color:var(--text-secondary)">待复习笔记 (${reviewNotes.length})</span>
          </div>
          ${reviewNotes.map(note => renderNoteReminder(note)).join('')}
        </div>
      ` : ''}

      ${overdue.length === 0 && today.length === 0 && upcoming.length === 0 && reviewNotes.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">🎉</div>
          <div class="empty-state-text">太棒了！<br>没有待处理的任务</div>
        </div>
      ` : ''}
    </div>
  `;

  container.querySelectorAll('.reminder-item').forEach(item => {
    item.addEventListener('click', async () => {
      const chapterId = item.dataset.chapterId;
      const chapter = STATE.chapters.find(c => c.id === chapterId);
      if (chapter) {
        await chrome.runtime.sendMessage({
          type: 'OPEN_CHAPTER',
          payload: { url: chapter.url, position: chapter.position }
        });
      }
    });
  });

  container.querySelectorAll('.note-reminder-item').forEach(item => {
    item.addEventListener('click', async () => {
      const noteId = item.dataset.noteId;
      const note = STATE.notes.find(n => n.id === noteId);
      if (note && note.url) {
        await chrome.runtime.sendMessage({
          type: 'OPEN_CHAPTER',
          payload: { url: note.url, position: note.timepoint }
        });
      }
    });
  });
}

function renderReminderItem(chapter, type) {
  const course = STATE.courses.find(c => c.id === chapter.courseId);
  const progress = chapter.duration ? calculateProgress(chapter.position, chapter.duration) : 0;
  const typeStyles = {
    danger: 'border-left:3px solid var(--danger)',
    warning: 'border-left:3px solid var(--warning)',
    info: 'border-left:3px solid var(--info)'
  };

  return `
    <div class="reminder-item card" data-chapter-id="${chapter.id}" style="${typeStyles[type]};padding:12px;cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div style="font-weight:600;font-size:13px;flex:1;margin-right:8px">${escapeHtml(chapter.name)}</div>
        <span class="badge ${type === 'danger' ? 'badge-danger' : type === 'warning' ? 'badge-warning' : 'badge-info'}">
          ${getRelativeDate(chapter.dueDate)}
        </span>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">${course ? escapeHtml(course.name) : ''}</div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${progress}%"></div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
        已学 ${formatTime(chapter.position)} / ${formatTime(chapter.duration || 0)} (${progress}%)
      </div>
    </div>
  `;
}

function renderNoteReminder(note) {
  return `
    <div class="note-reminder-item card" data-note-id="${note.id}" style="padding:12px;cursor:pointer;border-left:3px solid var(--warning)">
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
        <span class="badge badge-warning">⏱ ${formatTime(note.timepoint)}</span>
        ${(note.tags || []).slice(0, 2).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
      </div>
      <div style="font-size:12px;color:var(--text-primary);line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px">${escapeHtml(note.content)}</div>
      <div style="font-size:11px;color:var(--text-muted)">${escapeHtml(note.chapterName || '')}</div>
    </div>
  `;
}
