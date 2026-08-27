/**
 * Vetted cybersecurity sources.
 *
 * Every feed here was reachability-checked and returns parseable RSS/Atom
 * items. Fields:
 *
 *   weight   1.0 baseline. Higher = more authoritative for ranking and for
 *            deciding which copy of a cross-reported story becomes canonical.
 *   kind     'journalism' | 'research' | 'authority' | 'practitioner'
 *   topical  true  -> the whole feed is cybersecurity, accept everything.
 *            false -> mixed or general-interest feed, so an item must pass the
 *                     relevance filter before it can enter an edition.
 *
 * Run `npm run sources` to re-check the whole register.
 */
export const SOURCES = [
  // ---- Government, CERTs and national authorities -----------------------
  { id: 'cisa', name: 'CISA Advisories', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', kind: 'authority', weight: 1.9, topical: true },
  { id: 'cisa-ics', name: 'CISA ICS Advisories', url: 'https://www.cisa.gov/cybersecurity-advisories/ics-advisories.xml', kind: 'authority', weight: 1.7, topical: true },
  { id: 'cisa-news', name: 'CISA News', url: 'https://www.cisa.gov/news.xml', kind: 'authority', weight: 1.5, topical: true },
  { id: 'ncsc-uk', name: 'NCSC UK', url: 'https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml', kind: 'authority', weight: 1.7, topical: true },
  { id: 'cert-eu', name: 'CERT-EU', url: 'https://cert.europa.eu/publications/security-advisories-rss', kind: 'authority', weight: 1.6, topical: true },
  { id: 'cert-fr', name: 'CERT-FR', url: 'https://www.cert.ssi.gouv.fr/feed/', kind: 'authority', weight: 1.6, topical: true },
  { id: 'cccs-ca', name: 'Canadian Centre for Cyber Security', url: 'https://www.cyber.gc.ca/webservice/en/rss/alerts', kind: 'authority', weight: 1.6, topical: true },
  { id: 'ncsc-nl', name: 'NCSC Netherlands', url: 'https://advisories.ncsc.nl/rss/advisories', kind: 'authority', weight: 1.4, topical: true },
  { id: 'cert-pl', name: 'CERT Polska', url: 'https://cert.pl/en/rss.xml', kind: 'authority', weight: 1.3, topical: true },
  { id: 'certbr', name: 'CERT.br', url: 'https://www.cert.br/rss/certbr-rss.xml', kind: 'authority', weight: 1.2, topical: true },
  { id: 'jpcert', name: 'JPCERT/CC', url: 'https://blogs.jpcert.or.jp/en/atom.xml', kind: 'authority', weight: 1.4, topical: true },
  { id: 'sans-isc', name: 'SANS ISC', url: 'https://isc.sans.edu/rssfeed_full.xml', kind: 'authority', weight: 1.4, topical: true },

  // ---- Vendor security advisories ---------------------------------------
  { id: 'cisco-psirt', name: 'Cisco PSIRT', url: 'https://sec.cloudapps.cisco.com/security/center/psirtrss20/CiscoSecurityAdvisory.xml', kind: 'authority', weight: 1.5, topical: true },
  { id: 'ubuntu-usn', name: 'Ubuntu Security Notices', url: 'https://ubuntu.com/security/notices/rss.xml', kind: 'authority', weight: 1.3, topical: true },
  { id: 'debian-dsa', name: 'Debian Security', url: 'https://www.debian.org/security/dsa', kind: 'authority', weight: 1.3, topical: true },
  { id: 'redhat-sec', name: 'Red Hat Security', url: 'https://www.redhat.com/en/rss/blog/channel/security', kind: 'authority', weight: 1.2, topical: true },
  { id: 'gitlab-sec', name: 'GitLab Security Releases', url: 'https://about.gitlab.com/security-releases.xml', kind: 'authority', weight: 1.2, topical: true },
  { id: 'chrome-releases', name: 'Chrome Releases', url: 'https://chromereleases.googleblog.com/feeds/posts/default', kind: 'authority', weight: 1.4, topical: false },

  // ---- Journalism --------------------------------------------------------
  { id: 'krebs', name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/', kind: 'journalism', weight: 1.8, topical: true },
  { id: 'bleepingcomputer', name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/', kind: 'journalism', weight: 1.6, topical: true },
  { id: 'the-record', name: 'The Record', url: 'https://therecord.media/feed', kind: 'journalism', weight: 1.6, topical: true },
  { id: 'darkreading', name: 'Dark Reading', url: 'https://www.darkreading.com/rss.xml', kind: 'journalism', weight: 1.5, topical: true },
  { id: 'securityweek', name: 'SecurityWeek', url: 'https://www.securityweek.com/feed/', kind: 'journalism', weight: 1.5, topical: true },
  { id: 'cyber-dive', name: 'Cybersecurity Dive', url: 'https://www.cybersecuritydive.com/feeds/news/', kind: 'journalism', weight: 1.5, topical: true },
  { id: 'cyberscoop', name: 'CyberScoop', url: 'https://cyberscoop.com/feed/', kind: 'journalism', weight: 1.4, topical: true },
  { id: 'theregister-sec', name: 'The Register (Security)', url: 'https://www.theregister.com/security/headlines.atom', kind: 'journalism', weight: 1.4, topical: true },
  { id: 'riskybiz', name: 'Risky Business News', url: 'https://news.risky.biz/feed/', kind: 'journalism', weight: 1.4, topical: true },
  { id: 'wired-sec', name: 'WIRED Security', url: 'https://www.wired.com/feed/category/security/latest/rss', kind: 'journalism', weight: 1.4, topical: true },
  { id: 'hackernews', name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', kind: 'journalism', weight: 1.3, topical: true },
  { id: 'infosecurity', name: 'Infosecurity Magazine', url: 'https://www.infosecurity-magazine.com/rss/news/', kind: 'journalism', weight: 1.3, topical: true },
  { id: 'arstechnica', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', kind: 'journalism', weight: 1.3, topical: false },
  { id: 'portswigger-daily', name: 'PortSwigger Research', url: 'https://portswigger.net/research/rss', kind: 'research', weight: 1.5, topical: true },
  { id: 'csoonline', name: 'CSO Online', url: 'https://www.csoonline.com/feed/', kind: 'journalism', weight: 1.2, topical: true },
  { id: 'helpnet', name: 'Help Net Security', url: 'https://www.helpnetsecurity.com/feed/', kind: 'journalism', weight: 1.2, topical: true },
  { id: 'databreaches', name: 'DataBreaches.net', url: 'https://databreaches.net/feed/', kind: 'journalism', weight: 1.2, topical: true },
  { id: 'techcrunch-sec', name: 'TechCrunch Security', url: 'https://techcrunch.com/category/security/feed/', kind: 'journalism', weight: 1.2, topical: true },
  { id: 'zdnet-sec', name: 'ZDNET Security', url: 'https://www.zdnet.com/topic/security/rss.xml', kind: 'journalism', weight: 1.1, topical: true },
  { id: 'securityaffairs', name: 'Security Affairs', url: 'https://securityaffairs.com/feed', kind: 'journalism', weight: 1.1, topical: true },
  { id: 'itsecguru', name: 'IT Security Guru', url: 'https://www.itsecurityguru.org/feed/', kind: 'journalism', weight: 1.0, topical: true },
  { id: 'securitybrief', name: 'SecurityBrief', url: 'https://securitybrief.com.au/rss', kind: 'journalism', weight: 1.0, topical: false },

  // ---- Threat intelligence & vendor research -----------------------------
  { id: 'project-zero', name: 'Google Project Zero', url: 'https://googleprojectzero.blogspot.com/feeds/posts/default', kind: 'research', weight: 1.8, topical: true },
  { id: 'volexity', name: 'Volexity', url: 'https://www.volexity.com/feed/', kind: 'research', weight: 1.6, topical: true },
  { id: 'watchtowr', name: 'watchTowr Labs', url: 'https://labs.watchtowr.com/rss/', kind: 'research', weight: 1.6, topical: true },
  { id: 'google-security', name: 'Google Security Blog', url: 'https://security.googleblog.com/feeds/posts/default', kind: 'research', weight: 1.6, topical: true },
  { id: 'unit42', name: 'Unit 42', url: 'https://unit42.paloaltonetworks.com/feed/', kind: 'research', weight: 1.6, topical: true },
  { id: 'talos', name: 'Cisco Talos', url: 'https://blog.talosintelligence.com/rss/', kind: 'research', weight: 1.6, topical: true },
  { id: 'msft-security', name: 'Microsoft Security', url: 'https://www.microsoft.com/en-us/security/blog/feed/', kind: 'research', weight: 1.5, topical: true },
  { id: 'securelist', name: 'Kaspersky Securelist', url: 'https://securelist.com/feed/', kind: 'research', weight: 1.5, topical: true },
  { id: 'checkpoint', name: 'Check Point Research', url: 'https://research.checkpoint.com/feed/', kind: 'research', weight: 1.5, topical: true },
  { id: 'zdi', name: 'Zero Day Initiative', url: 'https://www.thezdi.com/blog?format=rss', kind: 'research', weight: 1.5, topical: true },
  { id: 'trailofbits', name: 'Trail of Bits', url: 'https://blog.trailofbits.com/feed/', kind: 'research', weight: 1.5, topical: true },
  { id: 'eset', name: 'ESET WeLiveSecurity', url: 'https://www.welivesecurity.com/en/rss/feed/', kind: 'research', weight: 1.4, topical: true },
  { id: 'sentinelone', name: 'SentinelOne Labs', url: 'https://www.sentinelone.com/blog/feed/', kind: 'research', weight: 1.4, topical: true },
  { id: 'crowdstrike', name: 'CrowdStrike', url: 'https://www.crowdstrike.com/blog/feed/', kind: 'research', weight: 1.4, topical: true },
  { id: 'sophos', name: 'Sophos X-Ops', url: 'https://news.sophos.com/en-us/category/security-operations/feed/', kind: 'research', weight: 1.4, topical: true },
  { id: 'redcanary', name: 'Red Canary', url: 'https://redcanary.com/feed/', kind: 'research', weight: 1.4, topical: true },
  { id: 'elastic-sec', name: 'Elastic Security Labs', url: 'https://www.elastic.co/security-labs/rss/feed.xml', kind: 'research', weight: 1.4, topical: true },
  { id: 'fortinet', name: 'Fortinet Threat Research', url: 'https://feeds.fortinet.com/fortinet/blog/threat-research', kind: 'research', weight: 1.4, topical: true },
  { id: 'trendmicro', name: 'Trend Micro Research', url: 'https://feeds.feedburner.com/TrendMicroSimplySecurity', kind: 'research', weight: 1.4, topical: true },
  { id: 'assetnote', name: 'Assetnote Research', url: 'https://www.assetnote.io/resources/research/rss.xml', kind: 'research', weight: 1.4, topical: true },
  { id: 'exodus', name: 'Exodus Intelligence', url: 'https://blog.exodusintel.com/feed/', kind: 'research', weight: 1.4, topical: true },
  { id: 'objective-see', name: 'Objective-See', url: 'https://objective-see.org/rss.xml', kind: 'research', weight: 1.4, topical: true },
  { id: 'specterops', name: 'SpecterOps', url: 'https://medium.com/feed/specter-ops-posts', kind: 'research', weight: 1.4, topical: true },
  { id: 'reversinglabs', name: 'ReversingLabs', url: 'https://www.reversinglabs.com/blog/rss.xml', kind: 'research', weight: 1.3, topical: true },
  { id: 'rapid7', name: 'Rapid7', url: 'https://blog.rapid7.com/rss/', kind: 'research', weight: 1.3, topical: true },
  { id: 'tenable', name: 'Tenable', url: 'https://www.tenable.com/blog/feed', kind: 'research', weight: 1.3, topical: true },
  { id: 'proofpoint', name: 'Proofpoint', url: 'https://www.proofpoint.com/us/rss.xml', kind: 'research', weight: 1.3, topical: true },
  { id: 'zscaler', name: 'Zscaler ThreatLabz', url: 'https://www.zscaler.com/blogs/feeds/security-research', kind: 'research', weight: 1.3, topical: true },
  { id: 'bitdefender', name: 'Bitdefender Labs', url: 'https://www.bitdefender.com/blog/api/rss/labs/', kind: 'research', weight: 1.3, topical: true },
  { id: 'group-ib', name: 'Group-IB', url: 'https://www.group-ib.com/blog/rss.xml', kind: 'research', weight: 1.3, topical: true },
  { id: 'intel471', name: 'Intel 471', url: 'https://intel471.com/blog/feed', kind: 'research', weight: 1.3, topical: true },
  { id: 'greynoise', name: 'GreyNoise', url: 'https://www.greynoise.io/blog/rss.xml', kind: 'research', weight: 1.3, topical: true },
  { id: 'doyensec', name: 'Doyensec', url: 'https://blog.doyensec.com/atom.xml', kind: 'research', weight: 1.3, topical: true },
  { id: 'bishopfox', name: 'Bishop Fox', url: 'https://bishopfox.com/feeds/blog.rss', kind: 'research', weight: 1.3, topical: true },
  { id: 'fox-it', name: 'Fox-IT', url: 'https://blog.fox-it.com/feed/', kind: 'research', weight: 1.3, topical: true },
  { id: 'quarkslab', name: 'Quarkslab', url: 'https://blog.quarkslab.com/feeds/all.atom.xml', kind: 'research', weight: 1.3, topical: true },
  { id: 'wiz', name: 'Wiz', url: 'https://www.wiz.io/feed/rss.xml', kind: 'research', weight: 1.3, topical: false },
  { id: 'silentpush', name: 'Silent Push', url: 'https://www.silentpush.com/feed/', kind: 'research', weight: 1.2, topical: true },
  { id: 'malwarebytes', name: 'Malwarebytes Labs', url: 'https://www.malwarebytes.com/blog/feed/index.xml', kind: 'research', weight: 1.2, topical: true },
  { id: 'cybereason', name: 'Cybereason', url: 'https://www.cybereason.com/blog/rss.xml', kind: 'research', weight: 1.2, topical: true },
  { id: 'flashpoint', name: 'Flashpoint', url: 'https://flashpoint.io/feed/', kind: 'research', weight: 1.2, topical: true },
  { id: 'qualys', name: 'Qualys', url: 'https://blog.qualys.com/feed', kind: 'research', weight: 1.2, topical: true },
  { id: 'nviso', name: 'NVISO Labs', url: 'https://blog.nviso.eu/feed/', kind: 'research', weight: 1.2, topical: true },
  { id: 'pentestpartners', name: 'Pen Test Partners', url: 'https://www.pentestpartners.com/feed/', kind: 'research', weight: 1.2, topical: true },
  { id: 'praetorian', name: 'Praetorian', url: 'https://www.praetorian.com/feed/', kind: 'research', weight: 1.2, topical: true },
  { id: 'censys', name: 'Censys', url: 'https://censys.com/feed/', kind: 'research', weight: 1.2, topical: true },
  { id: 'wordfence', name: 'Wordfence', url: 'https://www.wordfence.com/feed/', kind: 'research', weight: 1.2, topical: true },
  { id: 'sonatype', name: 'Sonatype', url: 'https://blog.sonatype.com/rss.xml', kind: 'research', weight: 1.2, topical: true },
  { id: 'openssf', name: 'OpenSSF', url: 'https://openssf.org/feed/', kind: 'research', weight: 1.2, topical: true },
  { id: 'aquasec', name: 'Aqua Security', url: 'https://blog.aquasec.com/rss.xml', kind: 'research', weight: 1.2, topical: true },
  { id: 'cloudflare', name: 'Cloudflare Blog', url: 'https://blog.cloudflare.com/rss/', kind: 'research', weight: 1.2, topical: false },
  { id: 'aws-sec', name: 'AWS Security', url: 'https://aws.amazon.com/blogs/security/feed/', kind: 'research', weight: 1.2, topical: true },
  { id: 'deepinstinct', name: 'Deep Instinct', url: 'https://www.deepinstinct.com/blog/feed', kind: 'research', weight: 1.1, topical: true },
  { id: 'varonis', name: 'Varonis', url: 'https://www.varonis.com/blog/rss.xml', kind: 'research', weight: 1.1, topical: true },
  { id: 'netskope', name: 'Netskope', url: 'https://www.netskope.com/blog/feed', kind: 'research', weight: 1.1, topical: true },
  { id: 'truesec', name: 'Truesec', url: 'https://www.truesec.com/hub/blog/rss', kind: 'research', weight: 1.1, topical: true },
  { id: 'sucuri', name: 'Sucuri', url: 'https://blog.sucuri.net/feed', kind: 'research', weight: 1.1, topical: true },
  { id: 'cloudsec-alliance', name: 'Cloud Security Alliance', url: 'https://cloudsecurityalliance.org/blog/feed', kind: 'research', weight: 1.1, topical: true },
  { id: 'cyentia', name: 'Cyentia Institute', url: 'https://www.cyentia.com/feed/', kind: 'research', weight: 1.0, topical: false },
  { id: 'snyk', name: 'Snyk', url: 'https://snyk.io/blog/feed/', kind: 'research', weight: 1.1, topical: false },
  { id: 'chainguard', name: 'Chainguard', url: 'https://www.chainguard.dev/unchained/rss.xml', kind: 'research', weight: 1.1, topical: false },
  { id: 'huntress', name: 'Huntress', url: 'https://www.huntress.com/blog/rss.xml', kind: 'research', weight: 1.2, topical: false },
  { id: 'sysdig', name: 'Sysdig', url: 'https://sysdig.com/feed/', kind: 'research', weight: 1.1, topical: false },
  { id: 'upguard', name: 'UpGuard', url: 'https://www.upguard.com/blog/rss.xml', kind: 'research', weight: 1.0, topical: false },
  { id: 'azure-blog', name: 'Microsoft Azure', url: 'https://azure.microsoft.com/en-us/blog/feed/', kind: 'research', weight: 1.0, topical: false },

  // ---- Practitioners & analysis ------------------------------------------
  { id: 'schneier', name: 'Schneier on Security', url: 'https://www.schneier.com/feed/atom/', kind: 'practitioner', weight: 1.6, topical: true },
  { id: 'tldrsec', name: 'tl;dr sec', url: 'https://tldrsec.com/feed.xml', kind: 'practitioner', weight: 1.4, topical: true },
  { id: 'troyhunt', name: 'Troy Hunt', url: 'https://www.troyhunt.com/rss/', kind: 'practitioner', weight: 1.4, topical: true },
  { id: 'scotthelme', name: 'Scott Helme', url: 'https://scotthelme.co.uk/rss/', kind: 'practitioner', weight: 1.1, topical: true },
  { id: 'errata-rob', name: 'Errata Security', url: 'https://blog.erratasec.com/feeds/posts/default', kind: 'practitioner', weight: 1.1, topical: true },
  { id: 'cluley', name: 'Graham Cluley', url: 'https://grahamcluley.com/feed/', kind: 'practitioner', weight: 1.1, topical: true },
  { id: 'miessler', name: 'Daniel Miessler', url: 'https://danielmiessler.com/feed', kind: 'practitioner', weight: 1.1, topical: false },
  { id: 'lawfare', name: 'Lawfare', url: 'https://www.lawfaremedia.org/feeds/articles', kind: 'practitioner', weight: 1.1, topical: false },
];

/** Terms that qualify an item from a mixed or general feed as in-scope. */
export const RELEVANCE_TERMS = [
  'cyber', 'security', 'infosec', 'hacker', 'hacking', 'hacked', 'breach',
  'malware', 'ransomware', 'phishing', 'spyware', 'botnet', 'trojan',
  'vulnerability', 'vulnerabilities', 'exploit', 'zero-day', 'zero day',
  'cve-', 'patch', 'backdoor', 'data leak', 'leaked data', 'credential',
  'encryption', 'cryptography', 'privacy', 'surveillance', 'authentication',
  'password', 'passkey', 'ddos', 'firewall', 'apt', 'threat actor',
  'espionage', 'darkweb', 'dark web', 'extortion', 'supply chain attack',
  'identity theft', 'fraud', 'scam', 'nation-state', 'cisa', 'nsa', 'gdpr',
  'attacker', 'intrusion', 'compromise', 'advisory', 'mitigation', 'exposed',
];
