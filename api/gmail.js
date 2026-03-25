// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function — Gmail Proxy
// ─────────────────────────────────────────────────────────────────────────────

// ── Layer 1: Conversational action language ───────────────────────────────────
const ACTION_PHRASES = [
  'please review', 'can you', 'could you', 'would you',
  'action required', 'action needed', 'your input', 'your approval',
  'follow up', 'follow-up', 'following up',
  'pending your', 'waiting on you', 'waiting for you',
  'please confirm', 'please respond', 'please reply',
  'please advise', 'let me know', 'your response',
  'urgent', 'asap', 'time-sensitive', 'time sensitive',
];

// ── Layer 2: Transactional/notice patterns ────────────────────────────────────
const NOTICE_PATTERNS = [
  // Renewals & expirations
  'renewal', 'renew', 'expires', 'expiring', 'expiration',
  'registration due', 'license due', 'due date',
  // Bills & payments
  'payment due', 'past due', 'overdue', 'invoice', 'balance due',
  'amount due', 'bill is ready', 'statement ready', 'pay now',
  'final notice', 'second notice', 'third notice',
  'your payment', 'autopay', 'auto-pay',
  // Appointments & confirmations
  'appointment', 'reminder', 'confirmation needed', 'confirm your',
  'schedule', 'rsvp', 'register by', 'deadline',
  // Shipping & deliveries
  'delivery attempt', 'out for delivery', 'signature required',
  'pickup available', 'held at',
  // Security & account
  'verify your', 'confirm your email', 'suspicious activity',
  'unauthorized', 'password reset', 'account suspended',
  'action needed', 'immediate action',
  // Healthcare
  'prescription ready', 'refill due', 'test results',
  'appointment reminder',
];

// ── Layer 3: Sender domain flags ──────────────────────────────────────────────
const ACTION_SENDER_DOMAINS = [
  // Government — federal, state, local
  '.gov',
  // Financial institutions
  'chase.com', 'bankofamerica.com', 'wellsfargo.com', 'citi.com',
  'capitalone.com', 'discover.com', 'americanexpress.com', 'amex.com',
  'navient.com', 'salliemae.com', 'mohela.com',
  'irs.gov', 'treasury.gov',
  // Insurance
  'aetna.com', 'bluecross.com', 'bcbs.com', 'cigna.com', 'humana.com',
  'unitedhealthcare.com', 'uhc.com', 'anthem.com',
  'statefarm.com', 'allstate.com', 'geico.com', 'progressive.com',
  'libertymutual.com', 'nationwide.com', 'usaa.com',
  // Utilities
  'comed.com', 'nicor.com', 'peoples-gas.com', 'cityofchicago.org',
  'att.com', 'verizon.com', 'comcast.com', 'xfinity.com', 'spectrum.com',
  // Healthcare
  'mychart.com', 'epic.com', 'walgreens.com', 'cvs.com', 'riteaid.com',
  // Subscriptions that auto-renew
  'netflix.com', 'apple.com', 'google.com', 'amazon.com',
];

// ── Blocklist — senders/subjects that are NEVER action items ─────────────────
// Matched against the raw From header and Subject line (case-insensitive).
// Add any sender name, email address, domain, or subject keyword here.
const BLOCKLIST = [
  // Real estate noise
  'redfin',
  // Newsletters & digests
  'daily digest',
  'off the dribble',
  // Food delivery
  'ubereats',
  'uber eats',
  'doordash',
  'grubhub',
  // Specific senders
  'tracy sorge',
  'tracysorge',
];

function isBlocked(subject, fromRaw) {
  const haystack = `${subject} ${fromRaw}`.toLowerCase();
  return BLOCKLIST.some(term => haystack.includes(term));
}

// ── Sender domain check ───────────────────────────────────────────────────────
function getSenderDomainFlag(fromRaw) {
  const lower = fromRaw.toLowerCase();
  for (const domain of ACTION_SENDER_DOMAINS) {
    if (lower.includes(domain)) return domain;
  }
  return null;
}

// ── Main detection function ───────────────────────────────────────────────────
function detectActionReason(subject, snippet, fromRaw) {
  const haystack = `${subject} ${snippet}`.toLowerCase();

  for (const phrase of ACTION_PHRASES) {
    if (haystack.includes(phrase)) return phrase;
  }

  for (const pattern of NOTICE_PATTERNS) {
    if (haystack.includes(pattern)) return pattern;
  }

  const domainFlag = getSenderDomainFlag(fromRaw);
  if (domainFlag) return `sender: ${domainFlag}`;

  return null;
}

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

  // ── debug ───────────────────────────────────────────────────────────────────
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

  // ── action_items ────────────────────────────────────────────────────────────
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
      const query = `is:unread -category:promotions -category:social after:${after}`;

      const listParams = new URLSearchParams({
        q:          query,
        maxResults: 40,
        fields:     'messages(id,threadId)',
      });

      const { ok: listOk, status: listStatus, data: listData } = await safeFetchJson(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams}`,
        { headers: authHeaders }
      );

      if (listStatus === 204 || (listOk && !listData.messages)) {
        return res.status(200).json({ emails: [], totalUnread: 0, actionedCount: 0 });
      }
      if (!listOk) {
        return res.status(500).json({ error: 'Gmail list failed', detail: listData.error?.message });
      }

      const messageIds = (listData.messages || []).map(m => m.id);

      if (messageIds.length === 0) {
        return res.status(200).json({ emails: [], totalUnread: 0, actionedCount: 0 });
      }

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
          const headers  = msg.payload?.headers || [];
          const subject  = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
          const from     = headers.find(h => h.name === 'From')?.value    || 'Unknown';
          const dateHdr  = headers.find(h => h.name === 'Date')?.value    || '';
          const snippet  = msg.snippet || '';
          const fromName = from.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || from;
          const flagReason = detectActionReason(subject, snippet, from);

          return {
            id:         msg.id,
            subject:    subject.slice(0, 120),
            from:       fromName.slice(0, 60),
            snippet:    snippet.slice(0, 200),
            date:       dateHdr,
            flagReason,
            isActioned: !!flagReason,
            link:       `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
            _from_raw:  from, // kept for blocklist check below
          };
        })
        // Apply blocklist — drop emails matching blocked senders/subjects entirely
        .filter(email => !isBlocked(email.subject, email._from_raw))
        // Clean up internal field before returning
        .map(({ _from_raw, ...rest }) => rest)
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
