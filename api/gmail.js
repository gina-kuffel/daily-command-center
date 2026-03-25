// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function — Gmail Proxy
//
// WHY THIS EXISTS:
// Keeps Google OAuth credentials server-side, never in the browser bundle.
// This proxy runs on Vercel, calls the Gmail REST API, and returns only
// the data the app needs.
//
// Supports one operation via ?op= query param:
//   op=action_items  — fetch recent unread personal emails and flag ones
//                      that contain action language
//
// REQUIRED VERCEL ENV VARS (server-side only, no REACT_APP_ prefix):
//   GMAIL_CLIENT_ID     — from Google Cloud Console → OAuth 2.0 Client
//   GMAIL_CLIENT_SECRET — from Google Cloud Console → OAuth 2.0 Client
//   GMAIL_REFRESH_TOKEN — long-lived refresh token from OAuth playground
//                         or your own OAuth flow
//
// HOW TO GET THESE (one-time setup):
//   1. Go to console.cloud.google.com → APIs & Services → Credentials
//   2. Create an OAuth 2.0 Client ID (type: Web application)
//   3. Add https://developers.google.com/oauthplayground as an authorized redirect URI
//   4. Go to https://developers.google.com/oauthplayground
//   5. Click the gear icon → check "Use your own OAuth credentials" → paste Client ID + Secret
//   6. In Step 1, select: Gmail API v1 → https://www.googleapis.com/auth/gmail.readonly
//   7. Click Authorize → Exchange code for tokens
//   8. Copy the Refresh Token → paste into Vercel as GMAIL_REFRESH_TOKEN
//
// The refresh token never expires unless you revoke it.
// ─────────────────────────────────────────────────────────────────────────────

// Keywords that suggest the email needs action from you
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

async function getAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
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

  if (op === 'action_items') {
    try {
      // Step 1: exchange refresh token for a fresh short-lived access token
      const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

      const authHeaders = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      // Step 2: search for unread emails, excluding promotions/social,
      // from the last 14 days — personal inbox focus
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 14);
      const after = `${cutoffDate.getFullYear()}/${String(cutoffDate.getMonth() + 1).padStart(2, '0')}/${String(cutoffDate.getDate()).padStart(2, '0')}`;

      const query = `is:unread -category:promotions -category:social -category:updates after:${after}`;

      const listParams = new URLSearchParams({
        q:          query,
        maxResults: 25,
        fields:     'messages(id,threadId)',
      });

      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams}`,
        { headers: authHeaders }
      );
      const listData = await listRes.json();

      if (!listRes.ok) {
        return res.status(500).json({ error: 'Gmail list failed', detail: listData.error?.message });
      }

      const messageIds = (listData.messages || []).map(m => m.id);

      if (messageIds.length === 0) {
        return res.status(200).json({ emails: [], totalUnread: 0 });
      }

      // Step 3: fetch metadata for each message in parallel (subject, from, snippet, date)
      const metaFetches = messageIds.map(id =>
        fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: authHeaders }
        ).then(r => r.json())
      );

      const messages = await Promise.all(metaFetches);

      // Step 4: parse and score each message
      const emails = messages
        .map(msg => {
          const headers  = msg.payload?.headers || [];
          const subject  = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
          const from     = headers.find(h => h.name === 'From')?.value    || 'Unknown';
          const dateHdr  = headers.find(h => h.name === 'Date')?.value    || '';
          const snippet  = msg.snippet || '';

          // Friendly sender name: strip the email address if a name is present
          // e.g. "John Smith <john@example.com>" → "John Smith"
          const fromName = from.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || from;

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
        // Surface actioned emails first, then the rest chronologically
        .sort((a, b) => (b.isActioned ? 1 : 0) - (a.isActioned ? 1 : 0));

      return res.status(200).json({
        emails,
        totalUnread: emails.length,
        actionedCount: emails.filter(e => e.isActioned).length,
      });
    } catch (e) {
      return res.status(500).json({ error: 'Gmail fetch failed', detail: e.message });
    }
  }

  return res.status(400).json({ error: `Unknown op: ${op}` });
};
