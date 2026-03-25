// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function — Google Calendar Proxy
// Reuses GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
// (refresh token must have been minted with calendar.readonly scope)
//
// ⚠️ PERSONAL CALENDAR ONLY
// This integration connects to Gina's *personal* Google Calendar — NOT her NIH
// work calendar (gina.kuffel@nih.gov / Outlook). Work meetings live in NIH
// Outlook/Exchange, which requires a separate Microsoft Graph integration.
// Events surfaced here are personal appointments, reminders, family events, etc.
//
// Calendars fetched:
//   1. primary                              — gina.kuffel@gmail.com
//   2. en.usa#holiday@group.v.calendar.google.com — Holidays in United States
// ─────────────────────────────────────────────────────────────────────────────

const CALENDAR_IDS = [
  'primary',
  'en.usa#holiday@group.v.calendar.google.com',
];

// ── Safe fetch ────────────────────────────────────────────────────────────────
async function safeFetchJson(url, options) {
  const res = await fetch(url, options);
  if (res.status === 204) return { ok: true, status: 204, data: {} };
  const text = await res.text();
  if (!text || text.trim() === '') {
    throw new Error(`Empty response from ${url} (status ${res.status})`);
  }
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    throw new Error(`Non-JSON response from ${url} (status ${res.status}): ${text.slice(0, 200)}`);
  }
}

// ── Token exchange ────────────────────────────────────────────────────────────
async function getAccessToken(clientId, clientSecret, refreshToken) {
  const { ok, data } = await safeFetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  if (!ok || !data.access_token) {
    throw new Error(`Token exchange failed: ${data.error} — ${data.error_description}`);
  }
  return data.access_token;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTodayTomorrowRange() {
  const now = new Date();

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setDate(end.getDate() + 2); // exclusive — start of day after tomorrow
  end.setHours(0, 0, 0, 0);

  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

function formatEvent(event, calendarId) {
  const summary   = event.summary || '(No title)';
  const location  = event.location || null;
  const htmlLink  = event.htmlLink || null;
  const attendees = (event.attendees || []).map(a => a.displayName || a.email);
  const organizer = event.organizer?.displayName || event.organizer?.email || null;
  const isHoliday = calendarId.includes('holiday');

  const startRaw = event.start?.dateTime || event.start?.date || null;
  const endRaw   = event.end?.dateTime   || event.end?.date   || null;
  const allDay   = !event.start?.dateTime;

  let timeLabel = 'All day';
  if (!allDay && startRaw) {
    const s = new Date(startRaw);
    const e = new Date(endRaw);
    const fmt = t => t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    timeLabel = `${fmt(s)} – ${fmt(e)}`;
  }

  // Personal-life prep keywords — NOT work meeting keywords
  // (Work calendar is NIH Outlook — separate integration)
  const prepKeywords = [
    // Medical & health
    'appointment', 'doctor', 'dentist', 'therapy', 'checkup', 'check-up',
    'follow-up', 'follow up', 'lab', 'test', 'results', 'procedure',
    'vaccine', 'vaccination', 'prescription',
    // Financial & admin
    'deadline', 'due date', 'payment', 'renewal', 'registration',
    'filing', 'tax', 'dmv', 'license',
    // Travel & logistics
    'flight', 'train', 'hotel', 'reservation', 'check-in', 'checkout',
    'pickup', 'drop-off', 'drop off',
    // Social & family
    'birthday', 'anniversary', 'dinner', 'party', 'event', 'wedding',
    'shower', 'graduation',
    // Reminders
    'remind', 'reminder', "don't forget", 'pick up',
  ];

  const lowerSummary = summary.toLowerCase();
  const needsPrep = !isHoliday && prepKeywords.some(kw => lowerSummary.includes(kw));

  return {
    id:         event.id,
    summary,
    timeLabel,
    allDay,
    startRaw,
    endRaw,
    location,
    organizer,
    attendees,
    htmlLink,
    needsPrep,
    isHoliday,
    calendarId,
  };
}

// Fetch events from a single calendar
async function fetchCalendarEvents(calendarId, accessToken, timeMin, timeMax) {
  const encodedId = encodeURIComponent(calendarId);
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy:      'startTime',
    maxResults:   50,
    fields:       'items(id,summary,start,end,location,htmlLink,attendees,organizer)',
  });

  const { ok, status, data } = await safeFetchJson(
    `https://www.googleapis.com/calendar/v3/calendars/${encodedId}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!ok) {
    // Non-fatal — log and return empty so one bad calendar doesn't break the whole response
    console.error(`Calendar fetch failed for ${calendarId}: ${status}`, data.error?.message);
    return [];
  }

  return (data.items || []).map(e => formatEvent(e, calendarId));
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const clientId     = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return res.status(500).json({
      error: 'Calendar proxy not configured',
      detail: 'Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in Vercel environment variables.',
    });
  }

  const { op = 'events' } = req.query;

  // ── debug ──────────────────────────────────────────────────────────────────
  if (op === 'debug') {
    try {
      const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
      const { ok, status, data } = await safeFetchJson(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=10',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!ok) return res.status(500).json({ error: 'Calendar list failed', status, detail: data });
      const calendars = (data.items || []).map(c => ({ id: c.id, summary: c.summary, primary: !!c.primary }));
      return res.status(200).json({ ok: true, calendars });
    } catch (e) {
      return res.status(500).json({ error: 'Debug failed', detail: e.message });
    }
  }

  // ── events (default) ───────────────────────────────────────────────────────
  if (op === 'events') {
    try {
      const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
      const { timeMin, timeMax } = getTodayTomorrowRange();

      // Fetch all calendars in parallel — one bad calendar won't break the rest
      const results = await Promise.all(
        CALENDAR_IDS.map(id => fetchCalendarEvents(id, accessToken, timeMin, timeMax))
      );

      // Merge and sort by start time
      const allEvents = results
        .flat()
        .sort((a, b) => (a.startRaw || '').localeCompare(b.startRaw || ''));

      const todayStr    = new Date().toISOString().slice(0, 10);
      const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

      const todayEvents    = allEvents.filter(e => (e.startRaw || '').startsWith(todayStr));
      const tomorrowEvents = allEvents.filter(e => (e.startRaw || '').startsWith(tomorrowStr));
      const prepItems      = allEvents.filter(e => e.needsPrep);

      return res.status(200).json({
        today:      todayEvents,
        tomorrow:   tomorrowEvents,
        prepItems,
        totalCount: allEvents.length,
        note: 'Personal Google Calendar only. NIH work calendar (Outlook) is a separate integration.',
      });
    } catch (e) {
      return res.status(500).json({ error: 'Calendar fetch failed', detail: e.message });
    }
  }

  return res.status(400).json({ error: `Unknown op: ${op}` });
};
