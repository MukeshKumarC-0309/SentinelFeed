/**
 * Outbound delivery: push each edition out instead of waiting for a visit.
 *
 * Three independent channels, all off unless configured, all best-effort - a
 * delivery failure is logged and never fails a refresh:
 *
 *   webhook  Slack-compatible JSON post (also works with Discord and generic
 *            endpoints) for every edition, or only for urgent stories.
 *   email    via an HTTP provider API, so there is no SMTP client and no
 *            dependency: Resend, Postmark, SendGrid and Mailgun are supported.
 *   alerts   high-urgency stories only, posted as they appear in an edition.
 */
import { config } from './config.js';
import { renderDigestText, renderDigestHtml } from './syndicate.js';

/** Stories that justify interrupting someone. */
export function urgentStories(edition) {
  const urgentSignals = new Set(['Active exploitation', 'Zero-day', 'CISA KEV', 'Emergency patch']);
  return edition.stories.filter((story) => (story.signals || []).some((s) => urgentSignals.has(s)));
}

async function postJson(url, body, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, body: text.slice(0, 300) };
  } catch (err) {
    return { ok: false, status: 0, body: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

/** Slack-style blocks, which Discord and generic webhooks also accept as text. */
function webhookPayload(edition, stories, { siteUrl, urgentOnly }) {
  const heading = urgentOnly
    ? `:rotating_light: ${stories.length} urgent ${stories.length === 1 ? 'story' : 'stories'} - edition ${edition.id}`
    : `SENTINEL FEED - edition ${edition.id} (${edition.stories.length} clippings)`;

  const lines = stories.slice(0, 10).map((story) => {
    const signals = (story.signals || []).length ? ` _(${story.signals.join(', ')})_` : '';
    return `• <${story.url}|${story.title}> — ${story.sourceName}${signals}`;
  });

  const text = [heading, '', ...lines, siteUrl ? `\n<${siteUrl}|Open the briefing>` : ''].join('\n');
  return { text, unfurl_links: false };
}

async function sendWebhook(edition, { log }) {
  if (!config.webhookUrl) return null;

  const urgentOnly = config.webhookUrgentOnly;
  const stories = urgentOnly ? urgentStories(edition) : edition.stories;
  if (!stories.length) {
    log(`[notify] webhook skipped (${urgentOnly ? 'no urgent stories' : 'no stories'})`);
    return null;
  }

  const result = await postJson(config.webhookUrl, webhookPayload(edition, stories, {
    siteUrl: config.siteUrl,
    urgentOnly,
  }));
  log(result.ok ? `[notify] webhook delivered (${stories.length} stories)` : `[notify] webhook failed: ${result.status} ${result.body}`);
  return result;
}

/**
 * Email through whichever provider is configured. Each provider is a couple of
 * lines because they all accept a simple JSON POST.
 */
async function sendEmail(edition, { log }) {
  const { emailProvider, emailApiKey, emailTo, emailFrom } = config;
  if (!emailProvider || !emailApiKey || !emailTo || !emailFrom) return null;

  const subject = `SENTINEL FEED - ${edition.stories.length} clippings (${edition.id})`;
  const text = renderDigestText(edition, { siteUrl: config.siteUrl, limit: config.emailStoryLimit });
  const html = renderDigestHtml(edition, { siteUrl: config.siteUrl, limit: config.emailStoryLimit });
  const recipients = emailTo.split(',').map((address) => address.trim()).filter(Boolean);

  let result;
  switch (emailProvider) {
    case 'resend':
      result = await postJson(
        'https://api.resend.com/emails',
        { from: emailFrom, to: recipients, subject, text, html },
        { authorization: `Bearer ${emailApiKey}` },
      );
      break;

    case 'postmark':
      result = await postJson(
        'https://api.postmarkapp.com/email',
        { From: emailFrom, To: recipients.join(','), Subject: subject, TextBody: text, HtmlBody: html, MessageStream: 'outbound' },
        { 'x-postmark-server-token': emailApiKey, accept: 'application/json' },
      );
      break;

    case 'sendgrid':
      result = await postJson(
        'https://api.sendgrid.com/v3/mail/send',
        {
          personalizations: [{ to: recipients.map((email) => ({ email })) }],
          from: { email: emailFrom },
          subject,
          content: [
            { type: 'text/plain', value: text },
            { type: 'text/html', value: html },
          ],
        },
        { authorization: `Bearer ${emailApiKey}` },
      );
      break;

    case 'mailgun': {
      if (!config.mailgunDomain) {
        log('[notify] email skipped: MAILGUN_DOMAIN is not set');
        return null;
      }
      const form = new URLSearchParams({ from: emailFrom, to: recipients.join(','), subject, text, html });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(`https://api.mailgun.net/v3/${config.mailgunDomain}/messages`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            authorization: `Basic ${Buffer.from(`api:${emailApiKey}`).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        });
        result = { ok: res.ok, status: res.status, body: (await res.text().catch(() => '')).slice(0, 300) };
      } catch (err) {
        result = { ok: false, status: 0, body: String(err?.message || err) };
      } finally {
        clearTimeout(timer);
      }
      break;
    }

    default:
      log(`[notify] unknown EMAIL_PROVIDER "${emailProvider}" - expected resend, postmark, sendgrid or mailgun`);
      return null;
  }

  log(result.ok ? `[notify] email sent to ${recipients.length} recipient(s) via ${emailProvider}` : `[notify] email failed: ${result.status} ${result.body}`);
  return result;
}

/**
 * Fire every configured channel. Never throws: delivery is a side effect of a
 * successful refresh, not a precondition for one.
 */
export async function deliver(edition, { log = console.log } = {}) {
  const results = {};
  for (const [name, fn] of [['webhook', sendWebhook], ['email', sendEmail]]) {
    try {
      results[name] = await fn(edition, { log });
    } catch (err) {
      results[name] = { ok: false, status: 0, body: String(err?.message || err) };
      log(`[notify] ${name} threw: ${err.message}`);
    }
  }
  return results;
}
