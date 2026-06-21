export const STORAGE_KEYS = {
  COURSES: 'courses',
  CHAPTERS: 'chapters',
  NOTES: 'notes',
  PLANS: 'plans',
  STREAKS: 'streaks',
  LAST_OPENED: 'lastOpened',
  SETTINGS: 'settings'
};

export const PLATFORMS = {
  bilibili: { name: '哔哩哔哩', color: '#FB7299', pattern: /bilibili\.com/ },
  coursera: { name: 'Coursera', color: '#0056D2', pattern: /coursera\.org/ },
  udemy: { name: 'Udemy', color: '#A435F0', pattern: /udemy\.com/ },
  youtube: { name: 'YouTube', color: '#FF0000', pattern: /youtube\.com|youtu\.be/ },
  netease: { name: '网易云课堂', color: '#CC0000', pattern: /study\.163\.com/ },
  mooc: { name: '中国大学MOOC', color: '#1C78C0', pattern: /icourse163\.org/ },
  tencent: { name: '腾讯课堂', color: '#12B7F5', pattern: /ke\.qq\.com/ },
  other: { name: '其他平台', color: '#64748B', pattern: /.*/ }
};

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function detectPlatform(url) {
  for (const [key, { pattern }] of Object.entries(PLATFORMS)) {
    if (pattern.test(url)) return key;
  }
  return 'other';
}

export function formatTime(seconds) {
  if (!seconds || seconds < 0) seconds = 0;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function parseTime(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatDateTime(date) {
  const d = new Date(date);
  return `${formatDate(d)} ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
}

export function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

export function getDaysDiff(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

export function isOverdue(date) {
  if (!date) return false;
  return getDaysDiff(new Date(), new Date(date)) > 0;
}

export function isToday(date) {
  if (!date) return false;
  return getDaysDiff(new Date(), new Date(date)) === 0;
}

export function getRelativeDate(date) {
  const diff = getDaysDiff(new Date(), new Date(date));
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  if (diff > 0 && diff < 7) return `${diff}天后`;
  if (diff < 0 && diff > -7) return `${-diff}天前`;
  return formatDate(date);
}

export function calculateProgress(progress, total) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((progress / total) * 100)));
}

export function estimateDuration(totalSeconds, daysLeft) {
  if (daysLeft <= 0 || totalSeconds <= 0) return 0;
  return Math.ceil(totalSeconds / daysLeft);
}

export function formatDuration(seconds) {
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `${mins}分钟`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}小时${remainMins}分钟` : `${hrs}小时`;
}

export async function storageGet(key, defaultValue = null) {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? defaultValue;
  } catch (e) {
    console.error('Storage get error:', e);
    return defaultValue;
  }
}

export async function storageSet(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
    return true;
  } catch (e) {
    console.error('Storage set error:', e);
    return false;
  }
}

export async function getCourses() {
  return await storageGet(STORAGE_KEYS.COURSES, []);
}

export async function getChapters() {
  return await storageGet(STORAGE_KEYS.CHAPTERS, []);
}

export async function getNotes() {
  return await storageGet(STORAGE_KEYS.NOTES, []);
}

export async function getPlans() {
  return await storageGet(STORAGE_KEYS.PLANS, []);
}

export async function saveCourse(course) {
  const courses = await getCourses();
  if (course.id) {
    const idx = courses.findIndex(c => c.id === course.id);
    if (idx >= 0) {
      courses[idx] = { ...courses[idx], ...course, updatedAt: Date.now() };
    } else {
      courses.push({ ...course, createdAt: Date.now(), updatedAt: Date.now() });
    }
  } else {
    course.id = generateId();
    course.createdAt = Date.now();
    course.updatedAt = Date.now();
    courses.push(course);
  }
  await storageSet(STORAGE_KEYS.COURSES, courses);
  return course;
}

export async function saveChapter(chapter) {
  const chapters = await getChapters();
  if (chapter.id) {
    const idx = chapters.findIndex(c => c.id === chapter.id);
    if (idx >= 0) {
      chapters[idx] = { ...chapters[idx], ...chapter, updatedAt: Date.now() };
    } else {
      chapters.push({ ...chapter, createdAt: Date.now(), updatedAt: Date.now() });
    }
  } else {
    chapter.id = generateId();
    chapter.createdAt = Date.now();
    chapter.updatedAt = Date.now();
    chapters.push(chapter);
  }
  await storageSet(STORAGE_KEYS.CHAPTERS, chapters);
  return chapter;
}

export async function saveNote(note) {
  const notes = await getNotes();
  if (note.id) {
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx >= 0) {
      notes[idx] = { ...notes[idx], ...note, updatedAt: Date.now() };
    } else {
      notes.push({ ...note, createdAt: Date.now(), updatedAt: Date.now() });
    }
  } else {
    note.id = generateId();
    note.createdAt = Date.now();
    note.updatedAt = Date.now();
    notes.push(note);
  }
  await storageSet(STORAGE_KEYS.NOTES, notes);
  return note;
}

export async function savePlan(plan) {
  const plans = await getPlans();
  if (plan.id) {
    const idx = plans.findIndex(p => p.id === plan.id);
    if (idx >= 0) {
      plans[idx] = { ...plans[idx], ...plan, updatedAt: Date.now() };
    } else {
      plans.push({ ...plan, createdAt: Date.now(), updatedAt: Date.now() });
    }
  } else {
    plan.id = generateId();
    plan.createdAt = Date.now();
    plan.updatedAt = Date.now();
    plans.push(plan);
  }
  await storageSet(STORAGE_KEYS.PLANS, plans);
  return plan;
}

export async function deleteChapter(chapterId) {
  const chapters = await getChapters();
  const filtered = chapters.filter(c => c.id !== chapterId);
  await storageSet(STORAGE_KEYS.CHAPTERS, filtered);

  const notes = await getNotes();
  const filteredNotes = notes.filter(n => n.chapterId !== chapterId);
  await storageSet(STORAGE_KEYS.NOTES, filteredNotes);
}

export async function deleteCourse(courseId) {
  const courses = await getCourses();
  const filtered = courses.filter(c => c.id !== courseId);
  await storageSet(STORAGE_KEYS.COURSES, filtered);

  const chapters = await getChapters();
  const courseChapters = chapters.filter(c => c.courseId === courseId);
  const filteredChapters = chapters.filter(c => c.courseId !== courseId);
  await storageSet(STORAGE_KEYS.CHAPTERS, filteredChapters);

  const chapterIds = courseChapters.map(c => c.id);
  const notes = await getNotes();
  const filteredNotes = notes.filter(n => !chapterIds.includes(n.chapterId));
  await storageSet(STORAGE_KEYS.NOTES, filteredNotes);
}

export async function deleteNote(noteId) {
  const notes = await getNotes();
  const filtered = notes.filter(n => n.id !== noteId);
  await storageSet(STORAGE_KEYS.NOTES, filtered);
}

export async function deletePlan(planId) {
  const plans = await getPlans();
  const filtered = plans.filter(p => p.id !== planId);
  await storageSet(STORAGE_KEYS.PLANS, filtered);
}

export async function updateStreak() {
  const streaks = await storageGet(STORAGE_KEYS.STREAKS, { current: 0, longest: 0, lastDate: null });
  const today = getTodayKey();
  
  if (streaks.lastDate === today) return streaks;
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().split('T')[0];
  
  if (streaks.lastDate === yesterdayKey) {
    streaks.current += 1;
  } else if (streaks.lastDate !== today) {
    streaks.current = 1;
  }
  
  streaks.longest = Math.max(streaks.longest, streaks.current);
  streaks.lastDate = today;
  
  await storageSet(STORAGE_KEYS.STREAKS, streaks);
  return streaks;
}

export async function getStreak() {
  return await storageGet(STORAGE_KEYS.STREAKS, { current: 0, longest: 0, lastDate: null });
}

export async function setLastOpened(chapterId, url, position) {
  await storageSet(STORAGE_KEYS.LAST_OPENED, {
    chapterId,
    url,
    position,
    timestamp: Date.now()
  });
}

export async function getLastOpened() {
  return await storageGet(STORAGE_KEYS.LAST_OPENED, null);
}

export function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
