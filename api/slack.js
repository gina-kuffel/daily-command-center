// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function — Slack Proxy
//
// WHY THIS EXISTS:
// We don't want the Slack token exposed in the browser bundle.
// This proxy runs on Vercel's servers, reads the token from a server-side
// env var, and calls the Slack API on behalf of the user.
//
// Supports one operation via ?op= query param:
//   op=mentions  — fetch recent @mentions from the last 7 days
//
// REQUIRED VERCEL ENV VARS (server-side only, no REACT_APP_ prefix):
//   SLACK_TOKEN — User OAuth Token (xoxp-...) from api.slack.com/apps
//
// The token needs these User Token Scopes:
//   search:read, users:read
// ─────────────────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.SLACK_TOKEN;
  if (!token) {
    return res.status(500).json({
      error: 'Slack proxy not configured — set SLACK_TOKEN in Vercel environment variables.',
    });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const { op = 'mentions' } = req.query;

  if (op === 'mentions') {
    try {
      // Step 1: get the authenticated user's ID so we can search for @mentions
      const authRes = await fetch('https://slack.com/api/auth.test', { headers });
      const authData = await authRes.json();

      if (!authData.ok) {
        return res.status(401).json({ error: 'Slack auth failed', detail: authData.error });
      }

      const userId = authData.user_id;

      // Step 2: search for messages mentioning this user in the last 7 days
      const params = new URLSearchParams({
        query: `<@${userId}>`,
        sort: 'timestamp',
        sort_dir: 'desc',
        count: 20,
      });

      const searchRes = await fetch(
        `https://slack.com/api/search.messages?${params}`,
        { headers }
      );
      const searchData = await searchRes.json();

      if (!searchData.ok) {
        return res.status(500).json({ error: 'Slack search failed', detail: searchData.error });
      }

      const sevenDaysAgo = Date.now() / 1000 - 7 * 24 * 60 * 60;
      const messages = (searchData.messages?.matches || [])
        .filter(m => parseFloat(m.ts) >= sevenDaysAgo)
        .map(m => ({
          ts:        m.ts,
          text:      m.text?.slice(0, 300) || '',
          username:  m.username || 'Unknown',
          channel:   m.channel?.name || m.channel?.id || 'unknown',
          channelId: m.channel?.id || '',
          permalink: m.permalink || '',
        }));

      return res.status(200).json({ mentions: messages, userId });
    } catch (e) {
      return res.status(500).json({ error: 'Slack fetch failed', detail: e.message });
    }
  }

  return res.status(400).json({ error: `Unknown op: ${op}` });
};
