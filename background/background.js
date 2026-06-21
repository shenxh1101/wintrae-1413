import {
  storageGet,
  storageSet,
  saveCourse,
  saveChapter,
  saveNote,
  savePlan,
  getChapters,
  getCourses,
  getNotes,
  getPlans,
  deleteChapter,
  deleteCourse,
  deleteNote,
  deletePlan,
  updateStreak,
  isToday,
  isOverdue,
  STORAGE_KEYS
} from '../common/utils.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  setupAlarms();
});

function setupAlarms() {
  chrome.alarms.clearAll(() => {
    chrome.alarms.create('dailyReminder', {
      when: getNextReminderTime(9, 0),
      periodInMinutes: 24 * 60
    });
    chrome.alarms.create('streakCheck', {
      when: getNextReminderTime(23, 0),
      periodInMinutes: 24 * 60
    });
  });
}

function getNextReminderTime(hour, minute) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailyReminder') {
    await checkAndNotify();
  } else if (alarm.name === 'streakCheck') {
    await checkStreak();
  }
});

async function checkAndNotify() {
  const chapters = await getChapters();
  const overdueList = chapters.filter(c => !c.completed && isOverdue(c.dueDate));
  const todayList = chapters.filter(c => !c.completed && isToday(c.dueDate));

  const total = overdueList.length + todayList.length;
  if (total > 0) {
    const messages = [];
    if (overdueList.length > 0) {
      messages.push(`逾期: ${overdueList.length}节`);
    }
    if (todayList.length > 0) {
      messages.push(`今日: ${todayList.length}节`);
    }

    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: '学习进度提醒',
      message: messages.join(' | '),
      priority: 2
    });
  }
}

async function checkStreak() {
  const streaks = await storageGet(STORAGE_KEYS.STREAKS, { current: 0, longest: 0, lastDate: null });
  const today = new Date().toISOString().split('T')[0];
  if (streaks.lastDate !== today) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: '别忘了学习！',
      message: `今天还没有学习记录哦，连续学习 ${streaks.current} 天即将中断`,
      priority: 2
    });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(e => {
    console.error('Message handling error:', e);
    sendResponse({ success: false, error: e.message });
  });
  return true;
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'SAVE_COURSE':
      return { success: true, data: await saveCourse(message.payload) };

    case 'SAVE_CHAPTER':
      const savedChapter = await saveChapter(message.payload);
      if (message.payload.position !== undefined) {
        await updateStreak();
      }
      return { success: true, data: savedChapter };

    case 'GET_COURSES':
      return { success: true, data: await getCourses() };

    case 'GET_CHAPTERS':
      return { success: true, data: await getChapters() };

    case 'GET_PLANS':
      return { success: true, data: await getPlans() };

    case 'GET_STREAK':
      return { success: true, data: await storageGet(STORAGE_KEYS.STREAKS, { current: 0, longest: 0, lastDate: null }) };

    case 'UPDATE_STREAK':
      return { success: true, data: await updateStreak() };

    case 'SET_LAST_OPENED':
      await storageSet(STORAGE_KEYS.LAST_OPENED, message.payload);
      return { success: true };

    case 'GET_LAST_OPENED':
      return { success: true, data: await storageGet(STORAGE_KEYS.LAST_OPENED, null) };

    case 'SAVE_NOTE':
      return { success: true, data: await saveNote(message.payload) };

    case 'GET_NOTES':
      return { success: true, data: await getNotes() };

    case 'DELETE_NOTE':
      await deleteNote(message.payload);
      return { success: true };

    case 'SAVE_PLAN':
      return { success: true, data: await savePlan(message.payload) };

    case 'DELETE_PLAN':
      await deletePlan(message.payload);
      return { success: true };

    case 'DELETE_CHAPTER':
      await deleteChapter(message.payload);
      return { success: true };

    case 'DELETE_COURSE':
      await deleteCourse(message.payload);
      return { success: true };

    case 'OPEN_CHAPTER':
      const { url } = message.payload;
      if (sender.tab?.windowId) {
        await chrome.tabs.update(sender.tab.id, { url });
      } else {
        await chrome.tabs.create({ url, active: true });
      }
      await updateStreak();
      return { success: true };

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

chrome.action.onClicked.addListener(async () => {
  try {
    await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  } catch (e) {
    console.error('Failed to open side panel:', e);
  }
});
