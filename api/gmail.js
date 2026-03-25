// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function — Gmail Proxy
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_PHRASES = [
  'please review', 'can you', 'could you', 'would you',
  'action required', 'action needed', 'your input', 'your approval',
  'follow up', 'follow-up', 'following up',
  'pending your', 'waiting on you', 'waiting for you',
  'please confirm', 'please respond', 'please reply',
  'reminder:', 'due today', 'due tomorrow', 'overdue',
  'payment due', 'invoice', 'appointment', 'confirmation needed',
  'rsvp', 'please advise', 'let me know',
  'urgent', 'asap', 'time-sensitive',
];

function detectActionReason(subject, snippet) {
  const haystack = `${subject} ${snippet}`.toLowerCase();
  for (const phrase of ACTION_PHRASES) {
    if (haystack.includes(phrase)) return phrase;
  }
  return null;
}

// Safe fetch → handles empty bodies (204 No Content) and non-JSON gracefully
async function safeFetchJson(url, options) {
  const res = await fetch(url, options);
  // 204 = No Content — valid empty response, not an error
  if (res.status === 204) {
    return { ok: true, status: 204, data: {} };
  }
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

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const clientId     = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return res.status(500).json({
      error: 'Gmail proxy not configured',
      detail: 'Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in Vercel environment variables.',
    });
  }

  const { op = 'action_items' } = req.query;

  // ── debug op ────────────────────────────────────────────────────────────────
  if (op === 'debug') {
    try {
      const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
      const { ok, status, data } = await safeFetchJson(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!ok) return res.status(500).json({ error: 'Profile fetch failed', status, detail: data });
      return res.status(200).json({
        ok: true,
        email: data.emailAddress,
        messagesTotal: data.messagesTotal,
        threadsTotal: data.threadsTotal,
      });
    } catch (e) {
      return res.status(500).json({ error: 'Debug failed', detail: e.message });
    }
  }

  // ── action_items op ─────────────────────────────────────────────────────────
  if (op === 'action_items') {
    try {
      const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

      const authHeaders = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 14);
      const after = `${cutoffDate.getFullYear()}/${String(cutoffDate.getMonth() + 1).padStart(2, '0')}/${String(cutoffDate.getDate()).padStart(2, '0')}`;
      const query = `is:unread -category:promotions -category:social -category:updates after:${after}`;

      const listParams = new URLSearchParams({
        q:          query,
        maxResults: 25,
        fields:     'messages(id,threadId)',
      });

      const { ok: listOk, status: listStatus, data: listData } = await safeFetchJson(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams}`,
        { headers: authHeaders }
      );

      // 204 or empty messages array = clean inbox for this filter
      if (listStatus === 204 || !listOk) {
        if (!listOk) return res.status(500).json({ error: 'Gmail list failed', detail: listData.error?.message });
        return res.status(200).json({ emails: [], totalUnread: 0, actionedCount: 0 });
      }

      const messageIds = (listData.messages || []).map(m => m.id);

      if (messageIds.length === 0) {
        return res.status(200).json({ emails: [], totalUnread: 0, actionedCount: 0 });
      }

      // Fetch metadata — skip any that fail rather than crashing the whole request
      const metaResults = await Promise.allSettled(
        messageIds.map(id =>
          safeFetchJson(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: authHeaders }
          )
        )
      );

      const emails = metaResults
        .filter(r => r.status === 'fulfilled' && r.value.ok && r.value.status !== 204)
        .map(r => r.value.data)
        .map(msg => {
          const headers   = msg.payload?.headers || [];
          const subject   = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
          const from      = headers.find(h => h.name === 'From')?.value    || 'Unknown';
          const dateHdr   = headers.find(h => h.name === 'Date')?.value    || '';
          const snippet   = msg.snippet || '';
          const fromName  = from.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || from;
          const flagReason = detectActionReason(subject, snippet);

          return {
            id:         msg.id,
            subject:    subject.slice(0, 120),
            from:       fromName.slice(0, 60),
            snippet:    snippet.slice(0, 200),
            date:       dateHdr,
            flagReason,
            isActioned: !!flagReason,
            link:       `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
          };
        })
        .sort((a, b) => (b.isActioned ? 1 : 0) - (a.isActioned ? 1 : 0));

      return res.status(200).json({
        emails,
        totalUnread:   emails.length,
        actionedCount: emails.filter(e => e.isActioned).length,
      });
    } catch (e) {
      return res.status(500).json({ error: 'Gmail fetch failed', detail: e.message });
    }
  }

  return res.status(400).json({ error: `Unknown op: ${op}` });
};
