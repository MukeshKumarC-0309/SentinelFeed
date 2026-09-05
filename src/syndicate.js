/**
 * Syndication: turn an edition into an RSS feed so the briefing can be read in
 * any feed reader, on any device, without opening the site.
 */

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const rfc822 = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
};

/**
 * RSS 2.0 for the current edition.
 *
 * Each item links to the publisher's article rather than back to this site:
 * the point is to route readers to the original reporting, and it keeps the
 * feed honest about whose work it is.
 */
export function renderRss(edition, { siteUrl, themeFilter = '' } = {}) {
  const stories = themeFilter
    ? edition.stories.filter((s) => (s.themes || []).some((t) => t.id === themeFilter))
    : edition.stories;

  const title = themeFilter
    ? `SENTINEL FEED - ${stories[0]?.themes?.find((t) => t.id === themeFilter)?.label || themeFilter}`
    : 'SENTINEL FEED - Cybersecurity Briefing';

  const items = stories
    .map((story) => {
      const categories = (story.themes || [])
        .map((t) => `      <category>${escapeXml(t.label)}</category>`)
        .join('\n');
      const signals = (story.signals || []).length
        ? `<p><strong>Signals:</strong> ${escapeXml(story.signals.join(', '))}</p>`
        : '';
      const also = (story.alsoReportedBy || []).length
        ? `<p><strong>Also reported by:</strong> ${story.alsoReportedBy
            .map((a) => `<a href="${escapeXml(a.url)}">${escapeXml(a.sourceName)}</a>`)
            .join(', ')}</p>`
        : '';

      return `    <item>
      <title>${escapeXml(story.title)}</title>
      <link>${escapeXml(story.url)}</link>
      <guid isPermaLink="true">${escapeXml(story.url)}</guid>
      <pubDate>${rfc822(story.publishedAt)}</pubDate>
      <source url="${escapeXml(siteUrl)}/feed.xml">${escapeXml(story.sourceName)}</source>
${categories}
      <description><![CDATA[<p>${escapeXml(story.summary)}</p>${signals}${also}]]></description>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <atom:link href="${escapeXml(siteUrl)}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Cybersecurity briefing rebuilt every ${edition.windowHours || 12} hours from vetted sources. Headlines and short extracts link to the original reporting.</description>
    <language>en</language>
    <lastBuildDate>${rfc822(edition.createdAt)}</lastBuildDate>
    <generator>SENTINEL FEED</generator>
    <ttl>360</ttl>
${items}
  </channel>
</rss>
`;
}

/** Plain-text digest, used for email and chat notifications. */
export function renderDigestText(edition, { siteUrl, limit = 12 } = {}) {
  const lines = [
    `SENTINEL FEED - edition ${edition.id}`,
    `${edition.stories.length} clippings from ${edition.meta?.sourcesOk ?? '?'} sources`,
    '',
  ];

  const outlook = edition.insights?.outlook?.lede;
  if (outlook) lines.push(outlook, '');

  edition.stories.slice(0, limit).forEach((story, index) => {
    lines.push(`${index + 1}. ${story.title}`);
    lines.push(`   ${story.sourceName}${story.signals?.length ? ` - ${story.signals.join(', ')}` : ''}`);
    lines.push(`   ${story.summary}`);
    lines.push(`   ${story.url}`);
    lines.push('');
  });

  if (siteUrl) lines.push(`Full briefing: ${siteUrl}`);
  return lines.join('\n');
}

/** HTML digest for email clients. */
export function renderDigestHtml(edition, { siteUrl, limit = 12 } = {}) {
  const story = (s, i) => `
    <tr><td style="padding:18px 0;border-bottom:1px solid #e3e8ee">
      <div style="font:600 11px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6b7c8f">
        ${i + 1} &middot; ${escapeXml(s.sourceName)}${
          s.signals?.length ? ` &middot; <span style="color:#c0392b">${escapeXml(s.signals.join(' / '))}</span>` : ''
        }
      </div>
      <div style="font:650 17px/1.35 -apple-system,Segoe UI,Roboto,sans-serif;margin:6px 0 8px">
        <a href="${escapeXml(s.url)}" style="color:#0f2233;text-decoration:none">${escapeXml(s.title)}</a>
      </div>
      <div style="font:400 14px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#42586d">${escapeXml(s.summary)}</div>
      <div style="margin-top:8px"><a href="${escapeXml(s.url)}" style="font:600 12px/1 -apple-system,sans-serif;color:#1273b8;text-decoration:none">Read at ${escapeXml(
        s.sourceName,
      )} &rarr;</a></div>
    </td></tr>`;

  const outlook = edition.insights?.outlook?.lede
    ? `<tr><td style="padding:16px 18px;background:#f4f7fa;border-left:3px solid #1273b8;font:400 14px/1.6 -apple-system,sans-serif;color:#2c4257">${escapeXml(
        edition.insights.outlook.lede,
      )}</td></tr>`
    : '';

  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#eef2f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:660px;margin:0 auto;background:#fff;border-radius:10px;padding:26px">
  <tr><td style="font:700 20px/1.2 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.12em;color:#0f2233">SENTINEL FEED</td></tr>
  <tr><td style="font:400 12px/1.5 -apple-system,sans-serif;color:#6b7c8f;padding-bottom:14px">Edition ${escapeXml(
    edition.id,
  )} &middot; ${edition.stories.length} clippings</td></tr>
  ${outlook}
  ${edition.stories.slice(0, limit).map(story).join('')}
  <tr><td style="padding-top:18px;font:400 12px/1.6 -apple-system,sans-serif;color:#8496a8">
    ${siteUrl ? `<a href="${escapeXml(siteUrl)}" style="color:#1273b8">Open the full briefing</a> &middot; ` : ''}
    Copyright in each article remains with its publisher.
  </td></tr>
</table></body></html>`;
}
