(function () {
  if (window.__studyTrackerInjected__) return;
  window.__studyTrackerInjected__ = true;

  const STATE = {
    position: 0,
    duration: 0,
    courseName: '',
    chapterName: '',
    url: location.href,
    videoDetected: false
  };

  function detectPlatform() {
    const hostname = location.hostname;
    if (hostname.includes('bilibili')) return 'bilibili';
    if (hostname.includes('coursera')) return 'coursera';
    if (hostname.includes('udemy')) return 'udemy';
    if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'youtube';
    if (hostname.includes('study.163')) return 'netease';
    if (hostname.includes('icourse163')) return 'mooc';
    if (hostname.includes('ke.qq')) return 'tencent';
    return 'other';
  }

  function getPageInfo() {
    const platform = detectPlatform();
    const info = {
      courseName: document.title,
      chapterName: '',
      platform,
      url: location.href
    };

    const platformSelectors = {
      bilibili: {
        course: '.media-title, .video-title, h1',
        chapter: '.list-box li.active, .on, .cur-list .on'
      },
      coursera: {
        course: 'h1, .rc-CourseHeader h1, #rendered-content h1',
        chapter: 'h2, .rc-ItemName, .video-name'
      },
      udemy: {
        course: '.course-landing-page__main-content h1, .clp-lead__title, h1',
        chapter: '.lecture-title h4, .curriculum-item-link--curriculum-item-title--1sY22, [data-purpose="video-title"]'
      },
      youtube: {
        course: 'h1 yt-formatted-string, ytd-watch-metadata h1',
        chapter: 'ytd-macro-markers-list-renderer ytd-macro-markers-list-item-renderer[active] .title, .ytp-chapter-title-content'
      },
      netease: {
        course: '.path span, .clsdetails_title h2, h1',
        chapter: '.chapter_title, .video-title, h2'
      },
      mooc: {
        course: '.course-title, h1',
        chapter: '.chapter-item.active, .j-title, .f-fc3'
      },
      tencent: {
        course: '.title-h1, h1',
        chapter: '.study-chapter.active, .chapter-title, .task-name'
      }
    };

    const selectors = platformSelectors[platform] || platformSelectors.other;
    
    const courseEl = document.querySelector(selectors.course);
    if (courseEl) info.courseName = courseEl.textContent.trim();
    
    const chapterEl = document.querySelector(selectors.chapter);
    if (chapterEl) info.chapterName = chapterEl.textContent.trim();

    if (!info.chapterName) {
      const heading = document.querySelector('h1, h2');
      if (heading && heading !== document.querySelector(selectors.course)) {
        info.chapterName = heading.textContent.trim();
      }
    }

    info.courseName = info.courseName || document.title;
    info.chapterName = info.chapterName || info.courseName;

    return info;
  }

  function findVideo() {
    const videos = document.querySelectorAll('video');
    let bestVideo = null;
    let maxDuration = 0;

    videos.forEach(video => {
      if (video.duration && video.duration > maxDuration) {
        maxDuration = video.duration;
        bestVideo = video;
      }
    });

    return bestVideo || videos[0] || null;
  }

  function updateVideoState() {
    const video = findVideo();
    if (video) {
      STATE.videoDetected = true;
      STATE.position = video.currentTime || 0;
      STATE.duration = video.duration || 0;
    }
    const pageInfo = getPageInfo();
    STATE.courseName = pageInfo.courseName;
    STATE.chapterName = pageInfo.chapterName;
    STATE.platform = pageInfo.platform;
    STATE.url = location.href;
  }

  function formatTime(seconds) {
    if (!seconds) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function createFloatingButton() {
    if (document.getElementById('study-tracker-fab')) return;

    const fab = document.createElement('div');
    fab.id = 'study-tracker-fab';
    fab.className = 'study-tracker-fab';
    fab.innerHTML = `
      <div class="st-fab-main" title="学习进度管家">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
          <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 2.84L19.16 12H17v7h-3v-6h-4v6H7v-7H4.84L12 5.84z"/>
        </svg>
        <span class="st-fab-tooltip">学习进度管家</span>
      </div>
      <div class="st-fab-menu">
        <button class="st-fab-menu-item" data-action="save">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
          </svg>
          <span>保存课程</span>
        </button>
        <button class="st-fab-menu-item" data-action="note">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 13h8v2H8v-2zm0 4h5v2H8v-2zm0-8h8v2H8V9z"/>
          </svg>
          <span>添加笔记</span>
        </button>
        <button class="st-fab-menu-item" data-action="screenshot">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
          </svg>
          <span>截图笔记</span>
        </button>
        <button class="st-fab-menu-item" data-action="resume">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <span>上次位置</span>
        </button>
      </div>
    `;
    document.body.appendChild(fab);

    const mainBtn = fab.querySelector('.st-fab-main');
    const menu = fab.querySelector('.st-fab-menu');
    let menuOpen = false;

    mainBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuOpen = !menuOpen;
      menu.style.display = menuOpen ? 'flex' : 'none';
    });

    document.addEventListener('click', () => {
      menuOpen = false;
      menu.style.display = 'none';
    });

    fab.querySelectorAll('.st-fab-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        handleAction(action);
        menuOpen = false;
        menu.style.display = 'none';
      });
    });
  }

  function showModal(config) {
    const existing = document.getElementById('study-tracker-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'study-tracker-modal';
    modal.className = 'study-tracker-modal-overlay';
    modal.innerHTML = `
      <div class="study-tracker-modal">
        <div class="st-modal-header">
          <span class="st-modal-title">${config.title}</span>
          <button class="st-modal-close">&times;</button>
        </div>
        <div class="st-modal-body">
          ${config.body}
        </div>
        ${config.footer ? `<div class="st-modal-footer">${config.footer}</div>` : ''}
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.st-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    return modal;
  }

  function closeModal() {
    const modal = document.getElementById('study-tracker-modal');
    if (modal) modal.remove();
  }

  async function handleAction(action) {
    updateVideoState();

    switch (action) {
      case 'save':
        showSaveDialog();
        break;
      case 'note':
        showNoteDialog();
        break;
      case 'screenshot':
        takeScreenshotNote();
        break;
      case 'resume':
        resumeLastPosition();
        break;
    }
  }

  function showSaveDialog() {
    updateVideoState();
    const body = `
      <div class="st-form-group">
        <label class="st-form-label">课程名称</label>
        <input type="text" class="st-input" id="st-course-name" value="${escapeAttr(STATE.courseName)}">
      </div>
      <div class="st-form-group">
        <label class="st-form-label">章节名称</label>
        <input type="text" class="st-input" id="st-chapter-name" value="${escapeAttr(STATE.chapterName)}">
      </div>
      <div class="st-form-row">
        <div class="st-form-group">
          <label class="st-form-label">当前位置</label>
          <input type="text" class="st-input" id="st-position" value="${formatTime(STATE.position)}">
          <div class="st-form-help">格式：时:分:秒 或 分:秒</div>
        </div>
        <div class="st-form-group">
          <label class="st-form-label">总时长</label>
          <input type="text" class="st-input" id="st-duration" value="${STATE.duration ? formatTime(STATE.duration) : ''}">
        </div>
      </div>
      <div class="st-form-group">
        <label class="st-form-label">主题/标签</label>
        <input type="text" class="st-input" id="st-tags" placeholder="用逗号分隔多个标签">
      </div>
      <div class="st-form-group">
        <label class="st-form-label">截止日期</label>
        <input type="date" class="st-input" id="st-due-date">
      </div>
    `;
    const footer = `
      <button class="st-btn st-btn-secondary" id="st-cancel">取消</button>
      <button class="st-btn st-btn-primary" id="st-save">保存</button>
    `;

    const modal = showModal({ title: '保存课程进度', body, footer });

    modal.querySelector('#st-cancel').addEventListener('click', closeModal);
    modal.querySelector('#st-save').addEventListener('click', async () => {
      const courseName = modal.querySelector('#st-course-name').value.trim();
      const chapterName = modal.querySelector('#st-chapter-name').value.trim();
      const position = parseTimeInput(modal.querySelector('#st-position').value);
      const duration = parseTimeInput(modal.querySelector('#st-duration').value);
      const tagsStr = modal.querySelector('#st-tags').value.trim();
      const dueDate = modal.querySelector('#st-due-date').value;

      if (!courseName || !chapterName) {
        alert('请填写课程名称和章节名称');
        return;
      }

      const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];

      const course = {
        name: courseName,
        platform: detectPlatform(),
        url: STATE.url,
        tags
      };

      const courseResult = await chrome.runtime.sendMessage({
        type: 'SAVE_COURSE',
        payload: course
      });

      const chapter = {
        courseId: courseResult.data.id,
        name: chapterName,
        url: STATE.url,
        position,
        duration: duration || null,
        dueDate: dueDate || null,
        completed: false
      };

      await chrome.runtime.sendMessage({
        type: 'SAVE_CHAPTER',
        payload: chapter
      });

      closeModal();
      showToast('课程已保存！');
    });
  }

  function showNoteDialog() {
    updateVideoState();
    const body = `
      <div class="st-form-group">
        <label class="st-form-label">时间点</label>
        <input type="text" class="st-input" id="st-note-time" value="${formatTime(STATE.position)}">
      </div>
      <div class="st-form-group">
        <label class="st-form-label">笔记内容</label>
        <textarea class="st-input st-textarea" id="st-note-content" placeholder="记录你的学习笔记..."></textarea>
      </div>
      <div class="st-form-group">
        <label class="st-form-label">标签</label>
        <input type="text" class="st-input" id="st-note-tags" placeholder="重点, 疑问, 考点...">
      </div>
      <div class="st-form-group">
        <label class="st-checkbox">
          <input type="checkbox" id="st-note-review">
          <span>标记为待复习</span>
        </label>
      </div>
    `;
    const footer = `
      <button class="st-btn st-btn-secondary" id="st-note-cancel">取消</button>
      <button class="st-btn st-btn-primary" id="st-note-save">保存笔记</button>
    `;

    const modal = showModal({ title: '添加笔记', body, footer });

    modal.querySelector('#st-note-cancel').addEventListener('click', closeModal);
    modal.querySelector('#st-note-save').addEventListener('click', async () => {
      const timepoint = parseTimeInput(modal.querySelector('#st-note-time').value);
      const content = modal.querySelector('#st-note-content').value.trim();
      const tagsStr = modal.querySelector('#st-note-tags').value.trim();
      const needsReview = modal.querySelector('#st-note-review').checked;

      if (!content) {
        alert('请输入笔记内容');
        return;
      }

      const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [];

      const note = {
        timepoint,
        content,
        tags,
        needsReview,
        url: STATE.url,
        chapterName: STATE.chapterName,
        screenshot: null
      };

      await chrome.runtime.sendMessage({
        type: 'SAVE_NOTE',
        payload: note
      });

      closeModal();
      showToast('笔记已保存！');
    });
  }

  async function takeScreenshotNote() {
    try {
      const video = findVideo();
      if (!video) {
        showToast('未检测到视频');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

      updateVideoState();
      const body = `
        <div class="st-screenshot-preview">
          <img src="${dataUrl}" alt="screenshot">
        </div>
        <div class="st-form-group">
          <label class="st-form-label">时间点</label>
          <input type="text" class="st-input" id="st-sc-time" value="${formatTime(STATE.position)}">
        </div>
        <div class="st-form-group">
          <label class="st-form-label">笔记内容</label>
          <textarea class="st-input st-textarea" id="st-sc-content" placeholder="截图说明..."></textarea>
        </div>
        <div class="st-form-group">
          <label class="st-checkbox">
            <input type="checkbox" id="st-sc-review">
            <span>标记为待复习</span>
          </label>
        </div>
      `;
      const footer = `
        <button class="st-btn st-btn-secondary" id="st-sc-cancel">取消</button>
        <button class="st-btn st-btn-primary" id="st-sc-save">保存截图笔记</button>
      `;

      const modal = showModal({ title: '截图笔记', body, footer });

      modal.querySelector('#st-sc-cancel').addEventListener('click', closeModal);
      modal.querySelector('#st-sc-save').addEventListener('click', async () => {
        const timepoint = parseTimeInput(modal.querySelector('#st-sc-time').value);
        const content = modal.querySelector('#st-sc-content').value.trim();
        const needsReview = modal.querySelector('#st-sc-review').checked;

        const note = {
          timepoint,
          content,
          tags: ['截图'],
          needsReview,
          url: STATE.url,
          chapterName: STATE.chapterName,
          screenshot: dataUrl
        };

        await chrome.runtime.sendMessage({
          type: 'SAVE_NOTE',
          payload: note
        });

        closeModal();
        showToast('截图笔记已保存！');
      });

    } catch (e) {
      console.error('Screenshot failed:', e);
      showToast('截图失败：' + e.message);
    }
  }

  async function resumeLastPosition() {
    const result = await chrome.runtime.sendMessage({
      type: 'GET_LAST_OPENED',
      payload: null
    });

    if (result.data && result.data.url === STATE.url) {
      const video = findVideo();
      if (video && result.data.position) {
        try {
          video.currentTime = result.data.position;
          showToast(`已跳转到 ${formatTime(result.data.position)}`);
        } catch (e) {
          showToast('无法跳转播放位置');
        }
      }
    } else {
      showToast('当前页面没有记录的播放位置');
    }
  }

  function parseTimeInput(str) {
    if (!str) return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function showToast(message) {
    const existing = document.getElementById('study-tracker-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'study-tracker-toast';
    toast.className = 'study-tracker-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function startTracking() {
    setInterval(() => {
      updateVideoState();
      if (STATE.videoDetected && STATE.position > 0) {
        chrome.runtime.sendMessage({
          type: 'SET_LAST_OPENED',
          payload: {
            url: STATE.url,
            position: STATE.position,
            timestamp: Date.now()
          }
        });
      }
    }, 10000);
  }

  function init() {
    setTimeout(() => {
      createFloatingButton();
      updateVideoState();
      startTracking();
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
