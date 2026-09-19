/* ====================================================================
   EXAM NOTIFICATION BOT - MAIN API ENDPOINT
   Handles:
     1. Telegram webhook updates -> subscriber management (subscribe/unsubscribe)
     2. Exam Submission POST    -> fan-out Student Name & Marks to subscribers
   ==================================================================== */

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUBSCRIBE_PASSWORD = process.env.SUBSCRIBE_PASSWORD || "2012";

// Storage Option 1: Supabase (PostgreSQL REST API)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Storage Option 2: Upstash Redis (HTTP REST API)
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Storage Option 3: Local in-memory set as fallback
const localSubscribers = new Set();
const localStates = new Map();

// ===== SUPABASE REST HELPER =====
async function supabase(endpoint, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const baseUrl = SUPABASE_URL.replace(/\/+$/, '');
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  try {
    const res = await fetch(`${baseUrl}/rest/v1/${endpoint}`, {
      ...options,
      headers
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('Supabase REST error:', res.status, errText);
      return null;
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    return true;
  } catch (err) {
    console.error('Supabase connection error:', err.message);
    return null;
  }
}

// ===== UPSTASH REDIS HELPERS (HTTP REST API) =====
async function redis(command, ...args) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN || UPSTASH_URL.includes('your-database')) {
    return null;
  }
  try {
    const path = [command, ...args].map(encodeURIComponent).join('/');
    const res = await fetch(`${UPSTASH_URL}/${path}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const json = await res.json();
    return json.result;
  } catch (err) {
    console.error('Redis error:', err.message);
    return null;
  }
}

// ===== SUBSCRIBER OPERATIONS (Supports Supabase, Upstash, or In-Memory) =====
async function addSubscriber(chatId) {
  if (SUPABASE_URL && SUPABASE_KEY) {
    const res = await supabase('subscribers', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ chat_id: String(chatId) })
    });
    if (res !== null) return true;
  }
  const res = await redis('sadd', 'exam_subscribers', String(chatId));
  if (res === null) localSubscribers.add(String(chatId));
  return res;
}

async function removeSubscriber(chatId) {
  if (SUPABASE_URL && SUPABASE_KEY) {
    const res = await supabase(`subscribers?chat_id=eq.${encodeURIComponent(chatId)}`, {
      method: 'DELETE'
    });
    if (res !== null) return true;
  }
  const res = await redis('srem', 'exam_subscribers', String(chatId));
  if (res === null) localSubscribers.delete(String(chatId));
  return res;
}

async function getAllSubscribers() {
  if (SUPABASE_URL && SUPABASE_KEY) {
    const rows = await supabase('subscribers?select=chat_id');
    if (Array.isArray(rows)) {
      return rows.map(r => String(r.chat_id));
    }
  }
  const result = await redis('smembers', 'exam_subscribers');
  if (Array.isArray(result) && result.length > 0) {
    return result;
  }
  return Array.from(localSubscribers);
}

async function isSubscribed(chatId) {
  if (SUPABASE_URL && SUPABASE_KEY) {
    const rows = await supabase(`subscribers?chat_id=eq.${encodeURIComponent(chatId)}&select=chat_id`);
    if (Array.isArray(rows)) return rows.length > 0;
  }
  const result = await redis('sismember', 'exam_subscribers', String(chatId));
  if (result !== null) return result === 1;
  return localSubscribers.has(String(chatId));
}

// ===== STATE OPERATIONS (5-minute TTL) =====
async function setState(chatId, state) {
  if (SUPABASE_URL && SUPABASE_KEY) {
    await supabase('bot_states', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ chat_id: String(chatId), state })
    });
    return;
  }
  const res = await redis('set', `state:${chatId}`, state, 'ex', '300');
  if (res === null) localStates.set(String(chatId), state);
}

async function getState(chatId) {
  if (SUPABASE_URL && SUPABASE_KEY) {
    const rows = await supabase(`bot_states?chat_id=eq.${encodeURIComponent(chatId)}&select=state`);
    if (Array.isArray(rows) && rows.length > 0) return rows[0].state;
    return null;
  }
  const res = await redis('get', `state:${chatId}`);
  if (res !== null) return res;
  return localStates.get(String(chatId)) || null;
}

async function clearState(chatId) {
  if (SUPABASE_URL && SUPABASE_KEY) {
    await supabase(`bot_states?chat_id=eq.${encodeURIComponent(chatId)}`, {
      method: 'DELETE'
    });
    return;
  }
  const res = await redis('del', `state:${chatId}`);
  if (res === null) localStates.delete(String(chatId));
}

// ===== TELEGRAM SEND MESSAGE HELPER =====
async function sendMessage(chatId, htmlText) {
  if (!BOT_TOKEN) {
    console.error('BOT_TOKEN is missing in environment variables.');
    return { ok: false, error: 'BOT_TOKEN is not configured' };
  }
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: htmlText,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  return res.json();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ===== EXAM NOTIFICATION FORMATTER =====
function formatExamNotification(data) {
  const now = new Date();
  const formatted = now.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const mins = Math.floor((data.durationSeconds || 0) / 60);
  const secs = (data.durationSeconds || 0) % 60;
  const durationStr = data.durationSeconds ? `${mins}m ${secs}s` : 'Practice';

  const marksDisplay = data.marks !== undefined ? data.marks : (data.score !== undefined ? data.score : '--');
  const maxMarksDisplay = data.maxMarks || 100;
  const percentageDisplay = data.percentage !== undefined ? `(${data.percentage}%)` : '';

  return (
    `🎓 <b>New Exam Submission!</b>\n\n` +
    `👤 <b>Student Name:</b> ${escapeHtml(data.studentName || data.name || data.fullname || 'Student')}\n` +
    `📚 <b>Exam:</b> ${escapeHtml(data.examTitle || 'CUET Mock Test')}\n` +
    `🏛️ <b>Department:</b> ${escapeHtml(data.department || 'General')}\n` +
    `🏆 <b>Final Marks:</b> <b>${marksDisplay} / ${maxMarksDisplay}</b> ${percentageDisplay}\n` +
    `⏱️ <b>Time Taken:</b> ${durationStr}\n` +
    `🕒 <b>Submitted:</b> ${formatted}`
  );
}

// ===== TELEGRAM UPDATE HANDLER =====
async function handleTelegramUpdate(update) {
  const message = update.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const rawText = message.text.trim();

  const parts = rawText.split(/\s+/);
  const rawCommand = parts[0];
  const command = rawCommand.split('@')[0];
  const args = parts.slice(1).join(' ');

  // /start command
  if (command === '/start') {
    if (args === SUBSCRIBE_PASSWORD) {
      await addSubscriber(chatId);
      await clearState(chatId);
      await sendMessage(
        chatId,
        `✅ <b>Subscribed successfully!</b>\n\nYou will now receive real-time notifications with student names and final marks when an exam is submitted.\n\n📋 Commands:\n/unsubscribe — Stop notifications\n/status — View subscriber count`
      );
      return;
    } else if (args !== '') {
      await sendMessage(chatId, `❌ <b>Incorrect password.</b>`);
      return;
    }

    const alreadySubscribed = await isSubscribed(chatId);
    if (alreadySubscribed) {
      await sendMessage(
        chatId,
        `✅ <b>You are already subscribed!</b>\n\nYou will receive notifications whenever a student completes an exam.\n\nSend /unsubscribe to stop.`
      );
    } else {
      await setState(chatId, 'awaiting_password');
      await sendMessage(
        chatId,
        `👋 <b>Welcome to Page Learning Exam Alerts!</b>\n\nThis bot sends real-time notifications with student names and final marks when students submit exams.\n\n🔐 Please enter the <b>password</b> to subscribe:`
      );
    }
    return;
  }

  // /unsubscribe command
  if (command === '/unsubscribe') {
    await removeSubscriber(chatId);
    await clearState(chatId);
    await sendMessage(
      chatId,
      `🔕 <b>You have been unsubscribed.</b>\n\nYou will no longer receive exam result notifications.\n\nSend /start anytime to subscribe again.`
    );
    return;
  }

  // /status command
  if (command === '/status') {
    const subscribers = await getAllSubscribers();
    await sendMessage(
      chatId,
      `📊 <b>Bot Status</b>\n\n👥 Total active subscribers: <b>${subscribers.length}</b>`
    );
    return;
  }

  // Password entry state
  const state = await getState(chatId);
  if (state === 'awaiting_password') {
    if (rawText === SUBSCRIBE_PASSWORD) {
      await addSubscriber(chatId);
      await clearState(chatId);
      await sendMessage(
        chatId,
        `✅ <b>Subscribed successfully!</b>\n\nYou will now receive real-time notifications with student names and final marks when an exam is submitted.\n\n📋 Commands:\n/unsubscribe — Stop notifications\n/status — View subscriber count`
      );
    } else {
      await sendMessage(
        chatId,
        `❌ <b>Incorrect password.</b>\n\nPlease try again:`
      );
    }
    return;
  }

  // Default fallback
  await sendMessage(
    chatId,
    `ℹ️ Send /start to subscribe to Page Learning exam notifications.`
  );
}

// ===== MAIN HANDLER =====
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};

  try {
    // PATH 1: Telegram Webhook Update
    if (body.update_id !== undefined) {
      await handleTelegramUpdate(body);
      return res.status(200).json({ ok: true });
    }

    // PATH 2: Exam Notification from Web Portal or Google Apps Script
    if (body.studentName !== undefined || body.marks !== undefined || body.fullname !== undefined || body.score !== undefined) {
      const subscribers = await getAllSubscribers();

      if (subscribers.length === 0) {
        return res.status(200).json({ ok: true, message: 'No subscribers registered yet' });
      }

      const message = formatExamNotification(body);

      // Fan out in parallel
      const results = await Promise.allSettled(
        subscribers.map(chatId => sendMessage(chatId, message))
      );

      return res.status(200).json({
        ok: true,
        notified: subscribers.length,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
      });
    }

    return res.status(400).json({ error: 'Unrecognized payload format' });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
