/**
 * Plain-English definitions for the vocabulary this corpus actually uses.
 *
 * Security reporting is written by practitioners for practitioners: 82% of a
 * typical edition carries at least one specialist term, and a single lead
 * story can assume eleven. Rather than rewrite other people's journalism, the
 * site explains the words in it.
 *
 * Rules these definitions follow:
 *   - one or two sentences, no jargon inside the definition itself;
 *   - say what it *is*, then why a reader should care;
 *   - no hedging, no "simply", no talking down.
 *
 * `aliases` catch the other spellings that appear in headlines. Matching is
 * longest-first, so "remote code execution" wins over "code execution".
 */
export const GLOSSARY = [
  // ---- Severity and disclosure -----------------------------------------
  { term: 'zero-day', aliases: ['0-day', 'zero day', '0day'], short: 'A flaw that attackers are using before the vendor has a fix available. There is no patch to install yet, which is what makes it urgent.' },
  { term: 'CVE', short: 'The public ID number given to one specific security flaw, like CVE-2026-93616. It lets everyone refer to the same bug without ambiguity.' },
  { term: 'CVSS', short: 'A 0–10 severity score for a flaw. Roughly: 9 and above is an emergency, 7–9 is serious, below 4 rarely keeps anyone up at night.' },
  { term: 'KEV', aliases: ['Known Exploited Vulnerabilities'], short: "A US government list of flaws confirmed to be under attack right now. If something lands on it, it has moved from theory to real." },
  { term: 'proof-of-concept', aliases: ['PoC'], short: 'Working code showing a flaw is genuinely exploitable. Publishing one usually means attacks increase within days.' },
  { term: 'patch', aliases: ['hotfix', 'security update'], short: 'A software update that closes a flaw. The gap between a patch being released and being installed is where most breaches happen.' },
  { term: 'mitigation', aliases: ['workaround'], short: 'A temporary way to reduce risk when no patch exists yet — turning a feature off, blocking a port, tightening a rule.' },
  { term: 'end of life', aliases: ['EOL'], short: 'The vendor has stopped supporting the product, so no more security fixes are coming. Anything still running it stays vulnerable permanently.' },
  { term: 'responsible disclosure', aliases: ['coordinated disclosure'], short: 'Telling the vendor about a flaw privately and giving them time to fix it before going public.' },

  // ---- The basics --------------------------------------------------------
  { term: 'vulnerability', aliases: ['flaw', 'security flaw'], short: 'A weakness in software or a system that someone could misuse. Having one is normal; leaving it unfixed is the problem.' },
  { term: 'exploit', aliases: ['exploited', 'exploitation'], short: 'The technique or code that actually takes advantage of a flaw. A vulnerability is the unlocked window; the exploit is climbing through it.' },
  { term: 'breach', short: 'An incident where an attacker got in and reached data or systems they should not have. The word covers everything from one stolen mailbox to a whole network.' },
  { term: 'attack surface', short: 'Everything about a system an attacker could reach and try. Reducing it is usually cheaper than defending all of it.' },
  { term: 'threat', short: 'Anything that could cause harm — a person, a piece of software, or a situation. Distinct from a vulnerability, which is the opening it would use.' },
  { term: 'risk', short: 'How likely harm is, combined with how bad it would be. The reason not every flaw gets fixed the same day.' },
  { term: 'hardening', short: 'Turning off what is not needed and tightening what is, so there is less to attack in the first place.' },
  { term: 'segmentation', aliases: ['network segmentation'], short: 'Splitting a network into separate zones so a break-in to one part cannot walk into the rest.' },
  { term: 'air gap', aliases: ['air-gapped'], short: 'Keeping a system physically disconnected from other networks. Strong protection, and frequently less complete in practice than assumed.' },
  { term: 'telemetry', aliases: ['logging', 'logs'], short: 'The record of what systems did — who logged in, what ran, what connected where. Without it, an investigation has nothing to work from.' },
  { term: 'worm', short: 'Malware that spreads by itself from machine to machine, with nobody needing to click anything.' },
  { term: 'spyware', aliases: ['stalkerware'], short: 'Software that secretly watches what someone does — messages, location, camera — and reports back.' },
  { term: 'keylogger', short: 'Software or hardware that records every key someone types, including passwords.' },
  { term: 'honeypot', short: 'A deliberately tempting fake system, put there so that anyone touching it reveals themselves.' },

  // ---- Attack techniques ------------------------------------------------
  { term: 'remote code execution', aliases: ['RCE'], short: "An attacker can run their own commands on the machine, over the network, without touching it. This is close to the worst case for a flaw." },
  { term: 'arbitrary code execution', short: 'The attacker gets to choose what code runs on the target. Effectively total control of that program.' },
  { term: 'privilege escalation', aliases: ['privesc', 'elevation of privilege'], short: 'Turning limited access into powerful access — going from an ordinary user account to administrator.' },
  { term: 'lateral movement', short: 'Once inside one machine, spreading sideways to others on the same network. Most breaches do far more damage after this step than before it.' },
  { term: 'authentication bypass', aliases: ['auth bypass'], short: 'Getting in without valid credentials — walking past the login screen rather than guessing a password.' },
  { term: 'unauthenticated', aliases: ['pre-auth', 'pre-authentication'], short: 'The attack works without logging in first. That removes the last obstacle, so these flaws are treated as far more dangerous.' },
  { term: 'SQL injection', aliases: ['SQLi'], short: "Tricking a website into treating attacker input as database commands, often exposing every record it holds." },
  { term: 'cross-site scripting', aliases: ['XSS'], short: "Getting your own JavaScript to run inside someone else's browser session on a trusted site, typically to steal what they can see." },
  { term: 'server-side request forgery', aliases: ['SSRF'], short: 'Making a server fetch a URL of the attacker\'s choosing, which often reaches internal systems the attacker could not reach directly.' },
  { term: 'path traversal', aliases: ['directory traversal'], short: 'Escaping the folder an application meant to confine you to, and reading or writing files elsewhere on the disk.' },
  { term: 'buffer overflow', short: 'Writing more data into a memory slot than it can hold, spilling into adjacent memory. A classic route to taking control of a program.' },
  { term: 'use-after-free', short: 'A program keeps using a piece of memory it has already released. Attackers put their own data in that space and hijack what happens next.' },
  { term: 'out-of-bounds', short: 'Reading or writing memory outside the region a program was allowed to touch — a common way to leak secrets or crash software.' },
  { term: 'race condition', short: "A bug that only appears when two operations happen at just the wrong moment. Hard to trigger reliably, which is why they hide for years." },
  { term: 'deserialization', aliases: ['deserialisation'], short: 'Turning stored or transmitted data back into live objects. If the data is attacker-controlled, this can hand them code execution.' },
  { term: 'command injection', short: 'Slipping extra system commands into input a program passes to the operating system.' },
  { term: 'prompt injection', short: 'Hiding instructions inside content an AI system reads, so it follows the attacker rather than its owner. The AI-era equivalent of injection flaws.' },
  { term: 'sandbox escape', short: 'Breaking out of the isolated box a program runs in — for example, from a browser tab to the rest of the computer.' },
  { term: 'denial of service', aliases: ['DoS', 'DDoS'], short: 'Overwhelming a service so real users cannot reach it. Not a break-in; an outage inflicted deliberately.' },
  { term: 'brute force', short: 'Trying enormous numbers of passwords or keys until one works.' },
  { term: 'credential stuffing', short: 'Taking username-password pairs leaked from one breach and trying them on other sites, betting people reuse passwords.' },
  { term: 'password spraying', short: 'Trying one common password against many accounts, which avoids the lockouts that repeated guesses on a single account would trigger.' },
  { term: 'adversary-in-the-middle', aliases: ['man-in-the-middle', 'AiTM', 'MitM'], short: 'Sitting between you and the site you think you are talking to, reading and altering what passes through.' },
  { term: 'living off the land', aliases: ['LOLBin', 'living-off-the-land'], short: 'Attacking using tools already built into the system, so nothing unusual gets installed and normal monitoring sees routine admin work.' },
  { term: 'watering hole', short: 'Compromising a site the intended victims already visit, and waiting for them to come to you.' },

  // ---- Malware and criminal operations ----------------------------------
  { term: 'malware', short: 'Any software written to do harm — a catch-all covering viruses, ransomware, spyware and the rest.' },
  { term: 'ransomware', short: 'Malware that locks up or steals an organisation\'s data and demands payment. Increasingly the threat is publishing the data rather than just withholding it.' },
  { term: 'double extortion', short: 'Stealing data *and* encrypting it, so paying to unlock the files still leaves the threat of publication.' },
  { term: 'infostealer', aliases: ['stealer', 'stealer log'], short: 'Malware that quietly harvests saved passwords, browser cookies and crypto wallets from a machine, then sells them on.' },
  { term: 'backdoor', short: 'A hidden way back into a system that survives after the original break-in is cleaned up.' },
  { term: 'rootkit', short: 'Malware that buries itself deep in the operating system to hide its own presence from the tools meant to find it.' },
  { term: 'bootkit', short: 'Malware that loads before the operating system does, which makes it extremely hard to detect or remove.' },
  { term: 'dropper', aliases: ['loader'], short: 'A small first-stage program whose only job is to fetch and install the real malware once it is safely inside.' },
  { term: 'botnet', short: 'A large collection of compromised machines under one operator\'s control, rented out for attacks or spam.' },
  { term: 'command and control', aliases: ['C2', 'C&C'], short: 'The servers malware phones home to for instructions. Finding this traffic is one of the most reliable ways to spot an intrusion.' },
  { term: 'payload', short: 'The part of an attack that actually does the damage, as opposed to the part that gets it in the door.' },
  { term: 'obfuscation', aliases: ['obfuscated'], short: 'Deliberately scrambling code so defenders and scanners cannot easily read what it does.' },
  { term: 'exfiltration', aliases: ['exfiltrate', 'data theft'], short: 'Copying stolen data out of the victim network to somewhere the attacker controls.' },
  { term: 'initial access broker', short: 'A criminal who breaks into organisations and sells that access on, rather than attacking further themselves.' },
  { term: 'ransomware-as-a-service', aliases: ['RaaS'], short: 'Ransomware rented out as a product, so affiliates with limited skill can run attacks and split the proceeds.' },
  { term: 'leak site', short: 'A site where an extortion group publishes stolen data from victims who refuse to pay.' },
  { term: 'dark web', short: 'Parts of the internet reachable only through anonymising software, where stolen data and criminal services are traded.' },

  // ---- People and attribution -------------------------------------------
  { term: 'threat actor', short: 'Whoever is behind an attack — a person, a criminal crew, or a government team. Deliberately neutral when attribution is uncertain.' },
  { term: 'advanced persistent threat', aliases: ['APT'], short: 'A well-resourced attacker, usually state-backed, who gets in and stays quietly for months or years rather than grabbing what they can and leaving.' },
  { term: 'nation-state', aliases: ['state-sponsored', 'state-backed'], short: 'An attack run or funded by a government, typically for espionage or to pre-position inside infrastructure.' },
  { term: 'attribution', short: 'Working out who was behind an attack. Genuinely hard, often contested, and rarely certain.' },
  { term: 'insider threat', short: 'Risk from someone who already has legitimate access — an employee or contractor, whether malicious or simply careless.' },
  { term: 'hacktivist', short: 'Someone attacking for a political or social cause rather than money.' },
  { term: 'red team', short: 'Security staff who attack their own organisation on purpose, to find what real attackers would.' },
  { term: 'blue team', short: 'The defenders — the people who monitor, detect and respond to attacks.' },
  { term: 'purple team', short: 'Attackers and defenders working together, so every attack technique tried immediately improves detection.' },
  { term: 'bug bounty', short: 'Paying outside researchers for flaws they find and report, rather than waiting for criminals to find them first.' },

  // ---- Social engineering ------------------------------------------------
  { term: 'phishing', short: 'A message designed to trick someone into handing over credentials or running something harmful. Still the most common way in.' },
  { term: 'spear phishing', aliases: ['spear-phishing'], short: 'Phishing aimed at one specific person, researched well enough to be convincing.' },
  { term: 'social engineering', short: 'Manipulating people rather than software — the help desk that resets a password for a convincing caller.' },
  { term: 'business email compromise', aliases: ['BEC'], short: 'Impersonating an executive or supplier to get an employee to transfer money or data. Low-tech and extremely costly.' },
  { term: 'vishing', short: 'Phishing by phone call, increasingly with an AI-cloned voice.' },
  { term: 'smishing', short: 'Phishing by text message. Effective because a phone screen hides the real destination of a link, and texts feel more personal than email.' },
  { term: 'deepfake', short: 'Synthetic video or audio convincing enough to impersonate a real person.' },
  { term: 'SIM swap', aliases: ['SIM swapping'], short: "Convincing a mobile carrier to move someone's number to an attacker's SIM, which captures their text-message login codes." },
  { term: 'typosquatting', short: 'Registering names one typo away from a real one, so mistakes land on the attacker instead.' },

  // ---- Identity and access -----------------------------------------------
  { term: 'credential', aliases: ['credentials'], short: 'Whatever proves who you are to a system — usually a username and password, sometimes a key or token.' },
  { term: 'multi-factor authentication', aliases: ['MFA', '2FA', 'two-factor'], short: 'Requiring a second proof beyond a password, such as a code or a tap. Defeats stolen passwords, though not every form is equally strong.' },
  { term: 'phishing-resistant', short: 'Login methods that cannot be relayed by a fake site — passkeys and hardware keys, as opposed to codes you can be talked into reading out.' },
  { term: 'passkey', aliases: ['FIDO2', 'WebAuthn'], short: 'A login tied to your device and the real site\'s address, so there is no password to steal and a fake site cannot use it.' },
  { term: 'session token', aliases: ['session cookie', 'access token'], short: 'The pass your browser holds after logging in. Steal it and you are already inside — no password or second factor needed.' },
  { term: 'single sign-on', aliases: ['SSO'], short: 'One login that opens many applications. Convenient, and a high-value target precisely because of that.' },
  { term: 'OAuth', short: 'The standard that lets one app act on your behalf in another without seeing your password. Abused grants are a common quiet backdoor.' },
  { term: 'SAML', short: 'An older standard for passing identity between systems, widely used for corporate single sign-on.' },
  { term: 'Active Directory', aliases: ['AD'], short: "Microsoft's system for managing accounts and permissions across a company network. Compromising it usually means compromising everything." },
  { term: 'Kerberos', short: 'The ticket-based login protocol behind Windows networks. Several well-known attacks target how those tickets are issued.' },
  { term: 'NTLM', short: 'An old Microsoft login protocol, still widely enabled and repeatedly shown to be weak.' },
  { term: 'identity provider', aliases: ['IdP'], short: 'The service that vouches for who you are across other applications — Okta, Entra ID and the like.' },
  { term: 'service account', aliases: ['non-human identity', 'machine identity'], short: 'A login used by software rather than a person. Often over-privileged, rarely rotated, and easy to forget about.' },
  { term: 'least privilege', short: 'Giving every account only the access it genuinely needs, so a compromise reaches as little as possible.' },
  { term: 'zero trust', short: 'Designing on the assumption that being inside the network proves nothing — every request has to justify itself.' },

  // ---- Defence and operations --------------------------------------------
  { term: 'endpoint detection and response', aliases: ['EDR', 'XDR'], short: 'Software on laptops and servers that watches behaviour and flags or blocks attacks, rather than only matching known malware.' },
  { term: 'SIEM', short: 'A system that collects logs from everywhere and raises alerts. The central nervous system of most security teams.' },
  { term: 'security operations centre', aliases: ['SOC'], short: 'The team that monitors for attacks and responds to them, often around the clock.' },
  { term: 'incident response', aliases: ['IR', 'DFIR'], short: 'The work of containing a breach, working out what happened, and getting operations back — usually under severe time pressure.' },
  { term: 'threat hunting', short: 'Actively searching for intruders who have not set off any alarm, rather than waiting for an alert.' },
  { term: 'detection engineering', short: 'Writing and testing the rules that spot attacks, treated as a software discipline with version control and tests.' },
  { term: 'indicator of compromise', aliases: ['IOC', 'IoC'], short: 'A concrete trace of an attack — a file hash, an address, a domain — that others can search their own systems for.' },
  { term: 'tactics, techniques and procedures', aliases: ['TTP', 'TTPs'], short: "How an attacker operates, rather than which tools they used. Harder for them to change than a file or address." },
  { term: 'MITRE ATT&CK', aliases: ['ATT&CK'], short: 'A shared catalogue of attacker techniques that gives defenders common language for what they are seeing.' },
  { term: 'dwell time', short: 'How long an intruder was inside before anyone noticed. Often measured in weeks.' },
  { term: 'attack surface', short: 'Everything about a system an attacker could possibly reach and try. Shrinking it is usually cheaper than defending it.' },
  { term: 'exposure management', short: 'Continuously knowing what of yours is reachable from the internet — because you cannot defend what you do not know you have.' },
  { term: 'penetration test', aliases: ['pen test', 'pentest'], short: 'A scoped, authorised simulated attack, done to find weaknesses before a real attacker does.' },
  { term: 'tabletop exercise', short: 'Walking through a hypothetical incident as a discussion, to find the decisions nobody has actually agreed on.' },
  { term: 'defence in depth', aliases: ['defense in depth'], short: 'Layering controls so that any single failure is not the whole story.' },
  { term: 'secure by design', short: 'Building software so that the safe behaviour is the default, instead of leaving customers to configure it correctly.' },

  // ---- Infrastructure ----------------------------------------------------
  { term: 'firewall', short: 'A device or software that controls which network traffic is allowed through. Increasingly a target in its own right.' },
  { term: 'VPN', short: 'An encrypted tunnel into a private network. Because it is exposed to the internet by design, VPN flaws are attacked hard and fast.' },
  { term: 'edge device', aliases: ['perimeter device'], short: "Equipment sitting between the internet and an internal network — firewalls, VPNs, gateways. The front door, and attacked accordingly." },
  { term: 'gateway', short: 'A system traffic must pass through to get in or out of a network.' },
  { term: 'endpoint', short: 'Any individual device on a network — a laptop, phone or server.' },
  { term: 'on-premises', aliases: ['on-prem'], short: 'Software running on hardware the organisation owns, rather than in a cloud provider.' },
  { term: 'operational technology', aliases: ['OT', 'ICS', 'SCADA'], short: 'The computers that run physical processes — factories, power, water. Failures here have consequences you can touch.' },
  { term: 'firmware', short: 'Software built into hardware itself. Rarely updated, hard to inspect, and persistent through a reinstall.' },
  { term: 'supply chain attack', aliases: ['supply-chain attack'], short: 'Compromising a supplier so the attack reaches everyone downstream who trusted them. One break-in, many victims.' },
  { term: 'software bill of materials', aliases: ['SBOM'], short: 'An ingredients list for software, so you can answer "are we affected?" without guessing.' },
  { term: 'dependency', short: 'Third-party code your software relies on. Modern applications have thousands, most of them never reviewed.' },
  { term: 'container', aliases: ['Kubernetes', 'Docker'], short: 'A way of packaging software with everything it needs to run, and the systems that orchestrate thousands of them.' },
  { term: 'API', short: 'The interface one piece of software uses to talk to another. Often less protected than the website in front of it.' },
  { term: 'remote monitoring and management', aliases: ['RMM'], short: 'Tools IT teams use to control machines remotely. Powerful by design, which is why attackers like them.' },
  { term: 'domain name system', aliases: ['DNS'], short: 'The internet\'s address book, turning names into numbers. Manipulating it can quietly redirect traffic.' },
  { term: 'BGP', short: 'The protocol deciding how traffic routes between networks. Built on trust, and occasionally abused to reroute traffic.' },
  { term: 'remote desktop protocol', aliases: ['RDP'], short: "Microsoft's remote control protocol. Exposed to the internet, it is one of the most reliably attacked services there is." },
  { term: 'SMB', short: 'The Windows file-sharing protocol, historically the vehicle for some of the fastest-spreading worms.' },
  { term: 'web application firewall', aliases: ['WAF'], short: 'A filter in front of a website that blocks recognisably malicious requests.' },

  // ---- Data and cryptography ---------------------------------------------
  { term: 'encryption', aliases: ['encrypted'], short: 'Scrambling data so only someone holding the key can read it. Protects information both while it travels and while it sits on a disk.' },
  { term: 'end-to-end encryption', aliases: ['E2EE'], short: 'Only the sender and recipient can read the content — not even the service carrying it.' },
  { term: 'hash', aliases: ['hashing'], short: 'A one-way fingerprint of data. Used to store passwords without keeping the password, and to identify files exactly.' },
  { term: 'TLS', aliases: ['SSL'], short: 'The encryption behind the padlock in your browser, protecting data in transit.' },
  { term: 'certificate authority', aliases: ['CA', 'PKI'], short: 'The organisations that vouch for which website is genuinely which. A great deal of trust rests on them.' },
  { term: 'post-quantum', aliases: ['quantum-safe', 'PQC'], short: 'Cryptography designed to survive future quantum computers. Urgent now because data stolen today could be decrypted later.' },
  { term: 'data breach', short: 'Confidential information ending up somewhere it should not be — whether stolen, leaked or simply left exposed.' },
  { term: 'personally identifiable information', aliases: ['PII'], short: 'Data that identifies a specific person. Its loss is what turns a technical incident into a legal one.' },
  { term: 'data minimisation', aliases: ['data minimization'], short: 'Keeping as little data as you can get away with, on the grounds that what you do not hold cannot be stolen.' },

  // ---- AI ----------------------------------------------------------------
  { term: 'large language model', aliases: ['LLM'], short: 'The kind of AI behind chat assistants. In security it is both a new tool for attackers and a new thing to defend.' },
  { term: 'AI agent', aliases: ['agentic'], short: 'An AI system that takes actions on your behalf — browsing, running tools, changing things — rather than only answering.' },
  { term: 'jailbreak', short: "Getting an AI system to ignore the restrictions its makers built in, usually by phrasing a request so the refusal does not trigger." },
  { term: 'model poisoning', aliases: ['data poisoning'], short: 'Corrupting the data a model learns from, so the finished system behaves as the attacker wants.' },
  { term: 'shadow AI', short: 'AI tools staff use for work without the organisation knowing, and therefore without any review of what data goes into them.' },

  // ---- Governance --------------------------------------------------------
  { term: 'CISA', short: 'The US federal agency for cybersecurity. Its advisories and its exploited-flaw list are treated as authoritative worldwide.' },
  { term: 'NIST', short: 'The US standards body whose security frameworks are widely adopted as a common yardstick.' },
  { term: 'CERT', aliases: ['CSIRT'], short: 'A national or organisational team that coordinates response to major security incidents.' },
  { term: 'GDPR', short: 'European data protection law, notable for requiring breach notification and carrying serious fines.' },
  { term: 'compliance', short: 'Meeting rules set by regulators or customers. Related to being secure, but not the same thing.' },
  { term: 'risk appetite', short: 'How much risk an organisation has decided it is willing to carry, ideally written down before the incident rather than after.' },
];

/** Every searchable form, longest first so specific phrases win. */
export function glossaryIndex() {
  const entries = [];
  for (const item of GLOSSARY) {
    for (const form of [item.term, ...(item.aliases || [])]) {
      entries.push({ form, term: item.term, short: item.short });
    }
  }
  return entries.sort((a, b) => b.form.length - a.form.length);
}
