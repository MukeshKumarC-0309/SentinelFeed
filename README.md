# SENTINEL FEED

A self-refreshing cybersecurity intelligence briefing. Every 12 hours it polls **113 vetted
security sources**, de-duplicates what they published, ranks it, writes a 5–6 line clipping
for each story, derives insights from the whole corpus, tracks how themes and named entities
move across editions, and rolls everything into a searchable archive where every clipping
still links to the original article.

No dependencies, no build step, no API keys required. Node 20+. Runs on macOS and Windows
(and anywhere else Node runs, in the foreground or under Docker).

```bash
sentinel           # start it if needed, then open it
```

That one command is the whole interface. The first edition builds on startup and takes
about 25 seconds.

| Command | Does |
| --- | --- |
| `sentinel` | Ensure it's running — reloading it if needed — then open it |
| `sentinel share` | URLs and a scannable QR code for your phone |
| `sentinel new` | Build a fresh edition now |
| `sentinel status` | Where it's installed, running, next refresh |
| `sentinel logs` | Follow the log |
| `sentinel stop` | Stop it, leaving it installed |
| `sentinel restart` | Restart it |
| `sentinel uninstall` | Remove the background service entirely |
| `sentinel help` | List the commands |

## Getting started

### macOS

```bash
brew install node                 # Node 20 or newer
git clone https://github.com/MukeshKumarC-0309/SentinelFeed.git
cd SentinelFeed
bin/sentinel install              # runs at login, adds the sentinel command
sentinel
```

No administrator rights are needed. Add `HOST=0.0.0.0` in front of the install command to
reach it from your phone (see [Reaching it from your other devices](#reaching-it-from-your-other-devices)).

### Windows

See [Running it on Windows](#running-it-on-windows) for the full guide. The short version, in
PowerShell or Command Prompt:

```
winget install OpenJS.NodeJS.LTS
git clone https://github.com/MukeshKumarC-0309/SentinelFeed.git
cd SentinelFeed
bin\sentinel install
```

Open a new terminal afterwards, and `sentinel` works from anywhere.

---

## What it does

**Briefing** — opens on a **cover**, not on the feed. The first screen is one story and a
few figures: the date and edition stamp, the lead headline set large with a two-line dek,
its urgency flag, and four numbers that answer what a reader actually arrives wanting to
know — active alerts, clippings, sources live, stories scanned. A live alert strip runs
above it carrying whatever the cover is *not* showing. One button drops into the feed.

The feed itself begins below the fold and carries ~60 clippings without ever presenting
them all at once:

1. **Top stories** — six cards, continuing from story two since the cover holds story one;
2. **More by topic** — everything else collapsed into per-topic sections showing a count,
   opening into a scannable one-line-per-story rail. The largest named topic opens by
   default; the untagged catch-all always sorts last.

A **Cards / Compact** switch turns the whole page into a single grouped list, and the choice
is remembered. When several outlets cover one story they merge into a single clipping, with
the rest kept as *also reported by* links.

**Insights** — analysis derived from the edition: what the pattern means now, what the
future could look like, which skills that creates demand for, and the habits of thought the
industry is encouraging. Every claim links the headlines that triggered it.

**Explain mode** — for anyone new to the field. 82% of a typical edition carries specialist
vocabulary, and a single lead story can assume eleven terms, so the **Explain** switch in the
header underlines the jargon in every summary and gives a one-sentence plain definition on
tap. It also adds a **Why this matters** line to each clipping and an **Easiest first**
ordering. Off by default; the expert reading is untouched.

**Reading memory** — the site remembers what it has already shown you. Around half of every
edition repeats the last one (measured: 40–72%), so the cover leads with **New for you**,
already-read clippings recede, unseen ones take the six card slots, and a **New only** filter
hides the rest. One stored profile, so a phone and a laptop agree about what is new.

**Follows** — star a topic, CVE or actor and the cover carries a single quiet line when one of
them moves. Silent until it has something to say.

**Trends** — the cross-edition view. Theme trajectories as sparklines with a rising /
falling / steady reading, plus ledgers of every CVE and named actor ranked by how many
editions they persisted across. Select a name to get its timeline.

**Skills across the archive** — inside Trends. The per-edition skills panel re-shuffles every
twelve hours, which is the wrong shape for "what should I learn?". This reads the whole
window and marks each skill *sustained*, *rising*, *fading* or *spike*, so durable demand
outranks whatever is loud today.

**The week in review** — at the top of Archive. Condenses the last seven days into what held
all week, what newly emerged, what went quiet, and which names and CVEs kept recurring.

**Search** — every clipping ever published, searchable by headline, source, topic or CVE.
Terms are ANDed; `"quoted phrases"` must match exactly.

**Archive** — past editions, expandable, each clipping still linked to its source.

**Sources** — the full register with the result of the most recent poll.

**RSS** — `/feed.xml` for any feed reader; `?theme=<id>` narrows it to one topic.

---

## How the insights are produced

This is worth being precise about, because "AI-generated commentary" usually means something
invented. Nothing here is invented, and no language model is involved.

`src/taxonomy.js` defines 19 tracked themes. Each declares the language that identifies it in
real reporting, plus prose written against that theme: what it implies now, where it
plausibly leads, which skills it creates demand for, and the shift in thinking it encourages.

Each refresh:

1. Every story in the 72-hour corpus is matched against all 19 themes.
2. A theme's score is the summed rank of the stories that matched it, times its weight — so
   one major story counts for more than several passing mentions.
3. Themes are ranked and converted into shares, then compared against the previous edition
   to produce momentum arrows.
4. Skills accumulate demand from every theme that references them, discounted by that
   theme's position in the ranking.
5. Convergences — observations that hold only when two patterns are simultaneously strong —
   are emitted only when both themes independently cleared their thresholds.

A theme with no matching stories contributes nothing, so the panel changes as the news
changes. Every derived claim renders with links to the stories behind it.

**In practice:** the *forward-looking* sentences are analyst-style extrapolations written in
advance per theme, and the engine decides which apply and how strongly. It is a structured
reading of the current cycle, not a forecast, and the page says so.

## Explaining the jargon

`src/glossary.js` holds 154 terms covering 92% of the stories in a typical edition — every
definition one or two sentences, written to say what a thing *is* and why it matters, with no
jargon inside the definition itself. Tests enforce that: a definition that is too short, that
restates its own term, or that leans on an unexplained acronym fails the suite.

Matching runs client-side over summaries and deks, longest form first so "remote code
execution" wins over "code execution", and only the first occurrence of each term in a block
is marked. Headlines are deliberately left alone: they are links, and a button inside an
anchor is invalid markup and bad for keyboard users.

The same matching produces an *approachability* figure — defined terms per hundred words —
which powers **Easiest first**. That reorders rather than filters, so nothing is hidden from
someone who wants it.

**Why this matters** reuses the theme implications already written in `src/taxonomy.js`.
Nothing is generated: a story tagged *Actively Exploited Edge & Perimeter* shows the prose
written for that theme, so the explanation is as accountable as the rest of the insights.

## Reading memory

`data/profile.json` holds two distinct states, both keyed by story id and both aged out with
the archive:

- **seen** — ids shown on a previous visit. Recomputed once per edition change and then held,
  so revisiting mid-cycle does not silently empty the page of "new".
- **read** — ids actually opened. Drives the dimming, nothing else.

There are no accounts. The profile belongs to whoever can reach the server, which is the same
trust boundary the rest of the site already has. Profile writes are the one class of POST that
does **not** require the refresh token: they change only personal reading state, cannot start
network activity or alter configuration, and are rate limited separately. Turning on
`REQUIRE_AUTH_FOR_READS` locks them down along with everything else.

## Trends and entity tracking

A single edition can only describe the moment. Two aggregate stores, rebuilt after every
refresh, give the site a memory:

- `data/trends.json` — per-edition theme shares, plus a ledger keyed by CVE and actor name
  recording first sighting, last sighting and every edition the entity appeared in.
- `data/search.json` — one compact record per clipping, so the whole archive is searchable
  without opening every edition file.

Direction of travel compares the recent half of the window against the earlier half, rather
than against a single prior edition, so one quiet cycle does not read as a collapse.

Both stores prune to `ARCHIVE_RETENTION_DAYS`. If you change the schema or want to backfill
an existing archive:

```bash
node scripts/rebuild-aggregates.js
```

---

## Sources

113 feeds, all verified to return parseable items, weighted by authority.

| Category | Count | Examples |
| --- | --- | --- |
| Government, CERTs & advisories | 18 | CISA (advisories, ICS, news), NCSC UK, CERT-EU, CERT-FR, CCCS Canada, NCSC-NL, CERT Polska, CERT.br, JPCERT/CC, SANS ISC, Cisco PSIRT, Ubuntu USN, Debian DSA, Red Hat, GitLab, Chrome Releases |
| Journalism | 21 | Krebs, BleepingComputer, The Record, Dark Reading, SecurityWeek, Cybersecurity Dive, CyberScoop, The Register, Risky Business, WIRED, The Hacker News, Infosecurity, Ars Technica, TechCrunch, ZDNET, CSO Online, DataBreaches.net |
| Vendor & lab research | 66 | Project Zero, Volexity, watchTowr, Unit 42, Talos, Microsoft, Securelist, Check Point, ZDI, Trail of Bits, Elastic Security Labs, ESET, SentinelOne, CrowdStrike, Sophos X-Ops, Red Canary, GreyNoise, Objective-See, SpecterOps, Trend Micro, Fortinet, Proofpoint, Zscaler |
| Practitioners | 8 | Schneier, tl;dr sec, Troy Hunt, Scott Helme, Errata Security, Graham Cluley, Daniel Miessler, Lawfare |

Mixed or general-interest feeds (Ars Technica, Cloudflare, Wiz, Snyk, Azure…) are filtered by
topic, so only security items enter an edition. No single feed may contribute more than
`MAX_ITEMS_PER_SOURCE` items per cycle, so a publisher that serves its whole history cannot
dominate the corpus.

```bash
npm run sources          # poll every feed and report health
```

---

## How a refresh works

```
poll 113 feeds (12 at a time, throttled per host, one retry on timeout)
  └─ parse RSS/Atom, decode entities, extract link + date + body
     └─ cap each feed's contribution, keep items published within 72h
        └─ first-pass summary + theme tagging on the whole corpus
           └─ de-duplicate: same URL, matching headlines, shared CVE, or shared rare names
              └─ rank: authority + freshness + urgency + corroboration + readability
                 │         − thin-summary penalty
                 └─ fetch the article for clippings whose blurb is short or cut off
                    └─ re-cluster (enrichment often reveals the shared CVE)
                       └─ publish the top 60, derive insights from all ~270
                          └─ write the edition, update trends + search stores
                             └─ roll the previous edition into the archive
                                └─ deliver to webhook / email if configured
```

**Choosing the clipping.** When outlets cluster, the one shown is not simply the most
authoritative. National CERT and vendor advisory feeds publish structured records — serial
numbers, affected-version matrices — which flatten into fragments with almost no sentence
structure. A readability score (sentence density, digit share) means the newsroom write-up
of a flaw leads, while the advisory stays attached as corroboration. Clustering also links
differently-worded coverage of one event by matching rare names in the headlines, so two
angles on the same breach do not both occupy the front page.

Feeds get one retry on a timeout or network error, never on an HTTP status. The first
attempt fails fast so a few slow hosts cannot stretch the cycle; only the retry waits the
longer timeout.

Some publishers (Dark Reading, SecurityWeek and others behind bot protection) return 403 to
automated article fetches. When a summary cannot be deepened, the story is ranked lower and a
rival outlet's fuller report is preferred as the clipping — the blocked outlet still appears
as a corroborating link.

## Refusing to publish a bad cycle

A refresh that reaches almost nothing must not replace a good edition with an empty one.
If fewer than `MIN_SOURCES_OK_RATIO` of sources responded, or no clipping survived, the run
is **abandoned**: nothing is written, the previous edition stays on the front page, and the
scheduler retries in `RETRY_AFTER_FAILURE_MINUTES` rather than waiting out the full cycle.

This is not hypothetical. Before the guard existed, a cycle that fired while the machine was
asleep reached 1 source out of 113, published an edition with zero stories, and rolled a
perfectly good 60-story front page into the archive — leaving the site blank until the next
refresh twelve hours later. `node scripts/repair-index.js` removes any empty editions left
by that behaviour and points the index back at the last edition that has stories.

## The 12-hour cycle

The next edition is due 12 hours after the last one was *written*, and that timestamp is
persisted. A 60-second tick checks whether it is due, so:

- restarting the server does not reset or skip the cycle;
- a machine asleep past the deadline refreshes once on waking, then resumes the cadence;
- a failed refresh waits out a cycle rather than hammering publishers.

---

## Running it permanently on macOS

`npm start` only runs the cycle while that terminal is open. To keep it up, install it as a
LaunchAgent:

```bash
npm run service:install
```

It starts at login and needs no administrator rights. It does stop at logout — running
through a logout would mean a system daemon under root, which is a poor fit for an app that
lives in your home directory, binds loopback by default, and holds no data worth that
privilege level.

| Command | Does |
| --- | --- |
| `npm run service:status` | Which mode, running?, current edition, next refresh |
| `npm run service:restart` | Restart now — or reload it if something unloaded the job |
| `npm run service:logs` | Follow the log |
| `npm run service:uninstall` | Remove whichever is installed (editions are left alone) |
| `bash scripts/service.sh refresh` | Build a new edition immediately |

Logs live in `~/Library/Logs/SentinelFeed/`.

**Guarantees:** starts by itself (`RunAtLoad`); restarts if it crashes or is killed
(`KeepAlive`); cannot spin on a persistent failure (`ThrottleInterval`); survives Node
upgrades (the plist points at the stable Homebrew symlink, not a `Cellar` path); keeps the
cycle across restarts. It runs as you, never as root, so everything under `data/` stays
owned by your account.

## Running it on Windows

Windows 10 (version 1903 or later) and Windows 11 are supported. Everything runs as your own
user; nothing needs administrator rights except the optional firewall rule for phone access.

### 1. Install Node.js

Node 20 or newer, from [nodejs.org](https://nodejs.org) or with:

```
winget install OpenJS.NodeJS.LTS
```

Close and reopen the terminal so `node` is on the PATH, then check with `node --version`.

### 2. Get the code

Either clone it with Git (`winget install Git.Git` if you do not have it; the repository is
private, so sign in when Git asks):

```
git clone https://github.com/MukeshKumarC-0309/SentinelFeed.git
cd SentinelFeed
```

or download it as a ZIP from GitHub (**Code > Download ZIP**), extract it, and open a
terminal in the extracted folder. Keep it somewhere that is not synced by OneDrive, such as
`C:\Users\<you>\SentinelFeed`: sync clients lock files while uploading them, and the
archive is rewritten every 12 hours.

To carry your existing archive over from another machine, copy its `data` folder into the
new one before installing.

### 3. Install it

```
bin\sentinel install
```

This:

- registers a **scheduled task** named `SentinelFeed` that starts the server at sign-in, with
  no window, and restarts it within about ten seconds if it ever stops. If Windows will not
  create the task without administrator rights, it uses a shortcut in your Startup folder
  instead, with the same behaviour;
- adds the app's `bin` folder to your user PATH, so `sentinel` works in any **new** terminal;
- waits for the first edition and prints the address.

Then:

```
sentinel
```

opens it in your default browser. The commands are the same as on macOS (see the table at the
top). The npm scripts work too: `npm run service:status`, `npm run service:logs` and so on.

### 4. Reach it from your phone (optional)

Install [Tailscale](https://tailscale.com/download) on the PC and your phone and sign both into
the same account. Then reinstall bound to all interfaces:

```
sentinel install -BindHost 0.0.0.0
```

Install remembers the setting, and uses the PC's tailnet name for feed links. It also prints a
firewall rule; run it once in PowerShell **opened as administrator**:

```powershell
New-NetFirewallRule -DisplayName 'SENTINEL FEED (Tailscale)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 4173 -InterfaceAlias Tailscale
```

The rule opens the port on the Tailscale adapter only, so the site stays closed to everyone
else on a shared Wi-Fi. If Windows shows its own firewall prompt for Node.js, you can cancel
it: the rule above is the narrower permission. Finally, run `sentinel share` and scan the QR
code with your phone.

### Where things live

| What | Where |
| --- | --- |
| Editions and archive | `data\` inside the app folder |
| Logs | `%LOCALAPPDATA%\SentinelFeed\logs\` (the previous run's log is kept alongside) |
| Install settings | `%LOCALAPPDATA%\SentinelFeed\service.json` |
| The task | Task Scheduler > Task Scheduler Library > `SentinelFeed` |

### Moving, updating and removing

- **Moved or renamed the folder?** Run `bin\sentinel install` from the new location.
  `sentinel status` warns when the task points at a folder that no longer exists.
- **Updating:** `git pull`, then `sentinel restart`.
- **Removing:** `sentinel uninstall` removes the task (or Startup shortcut), stops the
  server and takes `bin` off your PATH. The `data` folder is left alone; delete the app
  folder to remove everything.

### Troubleshooting

- **`sentinel` is not recognized:** open a new terminal (PATH changes only reach new ones),
  or run `bin\sentinel` from the app folder.
- **"running scripts is disabled on this system":** you ran a `.ps1` file directly. Use
  `sentinel` or `bin\sentinel`, which go through `sentinel.cmd` and bypass the execution
  policy for this app only, without changing the system setting.
- **It does not come up:** `sentinel logs` shows the server log, with recent errors first.
  `sentinel status` shows whether the task is running and its last result.
- **Port 4173 is taken:** `sentinel install -Port 4180`.
- **Phone cannot connect:** check that Tailscale is on at both ends, that you installed with
  `-BindHost 0.0.0.0`, and that the firewall rule exists
  (`Get-NetFirewallRule -DisplayName 'SENTINEL FEED*'`).
- The PC has to be awake. Under **Settings > System > Power**, set sleep to *Never* while
  plugged in if you want the phone to reach it at any time.

## Reaching it from your other devices

Run `sentinel share`, or press **Connect** in the header, and scan the QR code with your
phone's camera. Both list every address the server is actually answering on, each labelled
with where it works, best first.

### From anywhere, with Tailscale

This is the recommended setup. Install Tailscale on the Mac
(`brew install --cask tailscale-app`) and on your phone, and sign both into the same account.
(On Windows, see [Reach it from your phone](#4-reach-it-from-your-phone-optional).)
The site then leads with the Mac's tailnet name, for example
`http://your-mac.tailXXXX.ts.net:4173`. That link works over mobile data or any Wi-Fi, never
changes when your local IP does, and is encrypted end to end without exposing anything to the
internet. The Connect panel says so under the QR code: *works anywhere, as long as Tailscale
is on*.

The Mac still has to be awake and online. Turn on **Launch at login** in the Tailscale
menu-bar settings, or after a restart your phone cannot reach it until the app is opened.

One detail matters when running as a service: the macOS Tailscale binary acts as a command
line tool only when it can tell it was started from a terminal. Under launchd there is no
terminal, so without help it tries to open its window and fails. `src/network.js` sets
`TAILSCALE_BE_CLI=1` to force command-line mode, and runs the lookup asynchronously and
cached so a slow client never stalls a request.

### On the same Wi-Fi only

Without Tailscale, the Bonjour name (`http://your-mac.local:4173`) works from a phone on the
same network, falling back to the numeric address if `.local` names do not resolve (some
Android versions). Both stop working away from home, and the number changes whenever the
network does.

The site ships a web app manifest and icons, so **Add to Home Screen** on iOS or **Install
app** on Android gives it its own icon and a fullscreen window with no browser chrome. The
icons are generated, not checked in: `npm run icons` redraws them (`src/icon.js` rasterises
the mark and writes the PNG by hand, since iOS will not take an SVG).

### Binding to the network

By default the server binds `127.0.0.1` and is reachable only from this machine. Either route
above needs it opened up:

```bash
HOST=0.0.0.0 npm run service:install
```

`SITE_URL` defaults to the Mac's tailnet name when Tailscale is running, and to its Bonjour
name otherwise, so RSS and notification links open from your phone without extra
configuration. Reinstall after setting up Tailscale to pick the tailnet name up.

**What that changes:**

- **Reads stay open to anyone who can reach the port.** The content is public reporting,
  and requiring a token on every page load would break feed readers. On Tailscale that means
  only your own devices; on a shared Wi-Fi it means everyone on it.
- **Writes always need a token.** `POST /api/refresh` requires
  `Authorization: Bearer <token>` — a request from another device without it gets a 401.
- **The token** comes from `SENTINEL_TOKEN`, or is generated on first boot into
  `data/secret.json` (mode 0600) and printed to the log when binding non-loopback.
- **Rate limits** apply per client address: 300 reads/minute and 6 refreshes/hour by default.
- Set `REQUIRE_AUTH_FOR_READS=1` to lock reads down too; requests from this machine are still
  allowed through.

Only put this on the public internet behind a reverse proxy handling TLS and authentication,
and set `TRUST_PROXY=1` so rate limiting sees real client addresses rather than the proxy's.

## Delivery

All channels are off unless configured, and all are best-effort — a delivery failure is
logged and never fails a refresh.

**RSS** needs no configuration: `/feed.xml`, or `/feed.xml?theme=ransomware` for one topic.
Set `SITE_URL` so the links resolve.

**Webhook** (Slack, Discord or anything accepting a JSON post):

```bash
WEBHOOK_URL="https://hooks.slack.com/services/..."
WEBHOOK_URGENT_ONLY=1    # only actively-exploited / zero-day / KEV / emergency-patch stories
```

**Email digest** through an HTTP provider — no SMTP client, no dependency:

```bash
EMAIL_PROVIDER=resend        # resend | postmark | sendgrid | mailgun
EMAIL_API_KEY=...
EMAIL_FROM="briefing@your-domain"
EMAIL_TO="you@your-domain"   # comma-separated for several
MAILGUN_DOMAIN=...           # mailgun only
```

## Docker

```bash
docker compose up -d
```

Editions, aggregates and the token persist in the `sentinel-data` volume. The image runs as
the unprivileged `node` user and declares a healthcheck against `/api/status`. Set `SITE_URL`
so feed and notification links resolve, and change the port mapping to
`127.0.0.1:4173:4173` if you want it local-only.

> Not built here: this machine has the Docker CLI but no running daemon, so the image was
> never assembled. The app itself was verified under a container-style environment (stripped
> env, absolute `DATA_DIR`, `0.0.0.0` bind, healthcheck endpoint), but treat the first
> `docker compose up` as unproven.

---

## API

| Endpoint | Returns |
| --- | --- |
| `GET /api/briefing` | Current edition: stories, insights, meta |
| `GET /api/topics` | Every theme with its count in the current edition |
| `GET /api/trends` | Theme trajectories, CVE and actor ledgers, coverage window |
| `GET /api/entity/{cves\|actors}/{key}` | One entity's timeline and stories |
| `GET /api/search` | `q`, `theme`, `source`, `kind`, `from`, `to`, `limit`, `offset` |
| `GET /api/skills` | Skill demand across the archive, classified by durability |
| `GET /api/weekly` | The last `days` (default 7) condensed into what moved |
| `GET\|POST /api/profile` | Reading state and follows; POST registers a visit |
| `POST /api/profile/read` | `{ids}`, `{all:true}` or `{clear:true}` |
| `POST /api/profile/watch` | `{bucket, key, on}` — bucket is cves/actors/topics/sources |
| `GET /api/archive` | Edition index — current plus archived summaries |
| `GET /api/edition/:id` | One edition in full |
| `GET /api/status` | Cycle state, countdown, last-run statistics |
| `GET /api/sources` | Source register with last poll result |
| `GET /api/connect` | Reachable URLs plus a QR code for the best one |
| `GET /api/glossary` | The plain-English term list used by Explain mode |
| `GET /feed.xml` | RSS 2.0 of the current edition (`?theme=` to filter) |
| `POST /api/refresh` | Trigger a refresh (202). **Requires the token.** |

Responses carry `ETag` and are gzipped above 1 KB, so a polling client that sends
`If-None-Match` gets a 304 and no payload.

## Configuration

Everything is environment variables; defaults are the shipped behaviour.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` / `HOST` | `4173` / `127.0.0.1` | Listen address |
| `SITE_URL` | derived | Base URL used in RSS and notifications |
| `REFRESH_HOURS` | `12` | Cycle length |
| `MAX_STORY_AGE_HOURS` | `72` | Corpus window for an edition |
| `BRIEFING_SIZE` | `60` | Clippings on the front page |
| `MAX_ITEMS_PER_SOURCE` | `60` | Cap on items taken from any one feed |
| `MAX_ENRICHMENTS` | `60` | Cap on article fetches per refresh (`0` disables) |
| `MIN_PUBLISHABLE_CHARS` | `150` | Clippings below this are held back from the front page |
| `ARCHIVE_RETENTION_DAYS` | `365` | Prune editions and aggregates older than this (`0` keeps all) |
| `MIN_SOURCES_OK_RATIO` | `0.25` | Below this share of working sources, the run is abandoned |
| `RETRY_AFTER_FAILURE_MINUTES` | `30` | How soon to retry after an abandoned run |
| `FEED_CONCURRENCY` | `12` | Feeds fetched in parallel |
| `FEED_TIMEOUT_MS` | `25000` | Timeout for the retry attempt on a feed |
| `PER_HOST_DELAY_MS` | `400` | Minimum gap between requests to one host |
| `SENTINEL_TOKEN` | generated | API token for mutating endpoints |
| `REQUIRE_AUTH_FOR_READS` | off | Require the token for reads too |
| `READ_RATE_LIMIT` | `300` | Reads per minute per client |
| `WRITE_RATE_LIMIT` | `6` | Refreshes per hour per client |
| `PROFILE_RATE_LIMIT` | `240` | Reading-state writes per minute per client |
| `TRUST_PROXY` | off | Honour `X-Forwarded-For` (only behind your own proxy) |
| `DATA_DIR` | `data` | Where editions and aggregates are stored |

## Generated files

Three things are built rather than committed, so the repository holds no binaries and
nothing can drift out of sync with its source:

| Path | Built by | From |
| --- | --- | --- |
| `public/icons/*.png` | `npm run icons` | `src/icon.js` — rasterised and PNG-encoded in Node |
| `public/manifest.webmanifest` | `npm run icons` | the same script |
| `data/` | the refresh cycle | the feeds |

`.gitignore` covers all three. The server draws the icons on its first start if they are
missing; `npm run icons` redraws them.

## Layout

```
server.js              HTTP server, API, RSS, caching, auth, static files
src/config.js          Environment-driven settings
src/sources.js         The 113-source register
src/http.js            Fetch with timeout, throttling, bounded concurrency
src/xml.js             Tolerant RSS/Atom reader
src/html.js            HTML to text, sentence splitting
src/feeds.js           Feed parsing and normalisation
src/extract.js         Article text extraction for thin summaries
src/summary.js         5-6 line clipping construction
src/analyze.js         Ranking, urgency signals, duplicate clustering
src/taxonomy.js        19 themes, 37 skills - the interpretation layer
src/insights.js        Per-edition themes, outlook, skills, mindsets
src/aggregate.js       Cross-edition trends, entity ledgers, archive search
src/syndicate.js       RSS and digest rendering
src/notify.js          Webhook and email delivery
src/security.js        API token, rate limiting, client addressing
src/glossary.js        154 plain-English definitions for the jargon in the feed
src/qr.js              QR encoder (byte mode, level M) for device pairing
src/icon.js            Icon rasteriser and PNG encoder
src/network.js         Which addresses the server can be reached on (Tailscale first)
src/profile.js         Reading memory (seen/read) and follows
src/store.js           Editions, archive index
src/atomic.js          Atomic JSON writes, with retries for Windows file locks
src/pipeline.js        One full refresh
src/scheduler.js       The 12-hour cycle
public/                Frontend (no framework, no build)
data/editions/         One JSON file per edition
data/trends.json       Theme history and entity ledgers
data/search.json       Compact archive search index
data/profile.json      What you have seen, read and followed

scripts/service.js                    Runs the right service script for this platform
scripts/service.sh                    macOS service management (LaunchAgent)
scripts/service.ps1                   Windows service management (scheduled task)
scripts/com.sentinelfeed.server.plist LaunchAgent template
scripts/selftest.js                   Offline checks
scripts/check-sources.js              Feed health report
scripts/refresh-once.js               Build one edition and exit
scripts/rebuild-aggregates.js         Rebuild trends and search from editions
scripts/repair-index.js               Drop empty editions, restore the last good one
scripts/make-icons.js                 Generate home-screen icons and the manifest
scripts/share.js                      Print URLs and a terminal QR code
bin/sentinel                          The single command (macOS)
bin/sentinel.cmd, bin/sentinel.ps1    The single command (Windows)
```

## Commands

```bash
npm start                      # run the site in the foreground
npm test                       # 61 offline checks, no network
npm run refresh                # build one edition without starting the server
npm run sources                # poll every feed and report health
npm run service:install        # run in the background at login (macOS or Windows)
npm run service:status         # mode, state, current edition, next refresh
npm run service:logs           # follow the service log
npm run service:uninstall      # stop and remove the service
```

## Notes

- Feed content is escaped before reaching the DOM, and only `http(s)` links are rendered.
- Outbound links use `target="_blank"` with `rel="noopener noreferrer"`.
- Editions and aggregates are written atomically, so an interrupted refresh cannot corrupt
  the archive.
- Page assets are content-versioned, so a deployed change reaches already-cached devices
  instead of waiting out a cache lifetime.
- Only headlines and short extracts are stored; copyright stays with each publisher and every
  clipping links back to the original. Bear that in mind before exposing this publicly.
- The interface is dark by design; the **FX** toggle disables the grid, scanlines and glow.
  `prefers-reduced-motion` is respected automatically.
