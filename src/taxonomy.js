/**
 * The interpretation layer.
 *
 * Insights on this site are *derived*, not invented: each theme below declares
 * the language that identifies it in real reporting, and what that theme
 * implies for the industry's direction, hiring demand and habits of thought.
 * An insight only ever appears on the page when stories in the current edition
 * actually matched its patterns, and every claim is shown with the headlines
 * that triggered it.
 *
 * Theme fields
 *   match     regexes tested against headline + summary + categories
 *   weight    how strongly a match should move the signal score
 *   implication  what the pattern means right now
 *   horizon      the forward-looking sentence used in the outlook narrative
 *   mindset      the shift in thinking the pattern encourages
 *   skills       skill ids (defined in SKILLS) this theme creates demand for
 */

export const THEMES = [
  {
    id: 'ai-offense',
    label: 'AI-Enabled Offense',
    weight: 1.35,
    match: [
      /\b(ai|llm|genai|generative)\b[^.]{0,40}\b(attack|abuse|misuse|weapon|phish|scam|malware|exploit)/i,
      /\bprompt injection|jailbreak|indirect prompt|prompt forcing\b/i,
      /\b(deepfake|voice clon|synthetic media|ai-generated (?:phish|scam|voice|video))/i,
      /\b(agentic|ai agent|ai browser|browser agent|copilot|mcp)\b[^.]{0,50}\b(risk|abuse|hijack|attack|vulnerab|exfiltrat)/i,
      /\bwormgpt|fraudgpt|ai-?powered (?:attack|campaign|malware)/i,
    ],
    implication:
      'Attackers are using models to industrialise the parts of an intrusion that used to need human time: convincing pretexts, per-target lures, and now autonomous tool use inside a victim browser or agent runtime.',
    horizon:
      'Expect prompt injection and agent hijacking to be treated as a mainstream application vulnerability class, with AI agents becoming a monitored, permissioned identity rather than a trusted extension of the user.',
    mindset:
      'Treat any model that reads untrusted content as a confused deputy: assume its instructions can be rewritten by the data it processes, and design the blast radius accordingly.',
    skills: ['ai-security', 'prompt-injection-defense', 'threat-modeling', 'detection-engineering'],
  },
  {
    id: 'ai-defense',
    label: 'Securing AI Systems',
    weight: 1.25,
    match: [
      /\b(secure|securing|security of|guardrail|red team|safety) [^.]{0,30}\b(ai|llm|model|agent)s?\b/i,
      /\b(ai|llm|model) (security|governance|safety|guardrails|red teaming|assurance|risk management)\b/i,
      /\b(model|training data|weights) (poison|theft|leak|exfiltrat|supply chain)/i,
      /\b(ai (?:act|regulation|policy|framework)|nist ai rmf|ai bill of materials|aibom)\b/i,
      /\bshadow ai|ai inventory|ai usage polic/i,
    ],
    implication:
      'Organisations are shipping AI into production faster than they are governing it, so the defensive work is shifting to inventorying models, constraining what agents may touch, and red-teaming systems whose failure modes are probabilistic.',
    horizon:
      'AI assurance is likely to consolidate into a named discipline with its own reviews, test harnesses and audit evidence - closer to how application security matured after the first decade of web breaches.',
    mindset:
      'Security review is becoming empirical rather than checklist-driven: you probe a system statistically for failure, because you cannot read a model to prove it safe.',
    skills: ['ai-security', 'ai-governance', 'security-architecture', 'adversarial-testing'],
  },
  {
    id: 'exploited-edge',
    label: 'Actively Exploited Edge & Perimeter',
    weight: 1.4,
    match: [
      /\b(actively exploited|exploited in the wild|under (?:active )?(?:attack|exploitation)|in-the-wild exploitation)\b/i,
      /\b(known exploited vulnerabilit|kev catalog)\b/i,
      /\bzero[- ]day\b/i,
      /\b(vpn|firewall|gateway|edge device|appliance|load balancer|remote access)\b[^.]{0,40}\b(flaw|vulnerab|exploit|bug|breach|compromis)/i,
      /\b(ivanti|fortinet|fortigate|citrix|netscaler|pulse secure|sonicwall|palo alto|globalprotect|cisco asa|f5 big-ip|sharepoint|exchange server)\b/i,
      /\bemergency (?:patch|directive)|patch now|out-of-band (?:patch|update)/i,
    ],
    implication:
      'Internet-facing infrastructure remains the fastest route in, and the window between disclosure and mass exploitation is now measured in hours - which makes patch latency an operational metric rather than an IT chore.',
    horizon:
      'Expect continued pressure on the security of security products themselves, and for exposure management - knowing every asset you present to the internet, continuously - to outrank periodic vulnerability scanning.',
    mindset:
      'Assume the perimeter device is the target, not the shield; plan for compromise of the appliance that terminates your trust.',
    skills: ['vulnerability-management', 'exposure-management', 'incident-response', 'automation-engineering'],
  },
  {
    id: 'ransomware',
    label: 'Ransomware & Extortion',
    weight: 1.25,
    match: [
      /\bransomware|ransom (?:demand|payment|note)|double extortion|data extortion|leak site\b/i,
      /\b(lockbit|alphv|blackcat|cl0p|clop|akira|play ransomware|rhysida|qilin|medusa|blacksuit|hunters international|scattered spider|settra)\b/i,
      /\b(encrypted (?:their|the) (?:files|systems|network)|restore(?:d)? from backup|operations halted|production (?:halted|disrupted))\b/i,
      /\bransomware-as-a-service|raas|affiliate program\b/i,
    ],
    implication:
      'Extortion has settled into a service economy where access, encryption and negotiation are separate specialisms, and disruption of operations - not just data loss - is the leverage.',
    horizon:
      'The centre of gravity keeps moving from encryption toward pure data-theft extortion and pressure on third parties, which makes recovery planning less about restore speed and more about deciding, in advance, what you will do when data is already gone.',
    mindset:
      'Plan for recovery as a business exercise, not a backup job: rehearse the decisions, the communications and the legal exposure before the incident.',
    skills: ['incident-response', 'resilience-engineering', 'identity-security', 'tabletop-facilitation'],
  },
  {
    id: 'identity',
    label: 'Identity as the Primary Battleground',
    weight: 1.3,
    match: [
      /\b(mfa|2fa|multi-?factor)\b[^.]{0,30}\b(bypass|fatigue|push|phish|defeat)/i,
      /\b(session (?:hijack|token|cookie) (?:theft|abuse|replay)|token theft|stolen (?:cookies|session))\b/i,
      /\b(credential (?:stuffing|theft|harvest|dump)|password spray|infostealer|stealer log)\b/i,
      /\b(passkey|fido2|webauthn|phishing-resistant|passwordless)\b/i,
      /\b(okta|entra id|azure ad|active directory|identity provider|sso|oauth|saml)\b[^.]{0,40}\b(attack|abuse|breach|flaw|compromis|misconfig)/i,
      /\b(privilege escalation|service account|non-?human identit|machine identit|secret sprawl|leaked (?:api )?key)/i,
    ],
    implication:
      'Intrusions increasingly look like valid logins: stolen tokens, abused OAuth grants and over-privileged service accounts mean the decisive control is identity hygiene rather than malware detection.',
    horizon:
      'Non-human identities - service principals, agents, CI runners - are set to outnumber staff accounts by a wide margin, pushing identity teams toward short-lived credentials, continuous authorisation and an inventory of every machine actor.',
    mindset:
      'Stop treating authentication as a gate that is passed once; treat every request as needing fresh justification, and every credential as something that should expire on its own.',
    skills: ['identity-security', 'zero-trust-architecture', 'cloud-security', 'detection-engineering'],
  },
  {
    id: 'supply-chain',
    label: 'Software Supply Chain',
    weight: 1.3,
    match: [
      /\bsupply chain (?:attack|compromise|risk|security)\b/i,
      /\b(npm|pypi|rubygems|nuget|crates\.io|maven|go module|vs ?code extension|github action)\b[^.]{0,40}\b(malicious|backdoor|typosquat|compromis|hijack|worm|steal)/i,
      /\b(dependency confusion|typosquatting|slopsquatting|malicious package|package hijack)\b/i,
      /\b(sbom|software bill of materials|provenance|slsa|sigstore|code signing|signing key (?:theft|compromise))\b/i,
      /\b(build (?:system|pipeline)|ci\/?cd)\b[^.]{0,30}\b(compromis|attack|breach|abuse|poison)/i,
      /\b(third-?party|vendor|msp|managed service provider)\b[^.]{0,30}\b(breach|compromis|incident)/i,
    ],
    implication:
      'The unit of compromise is increasingly a dependency, a build step or a vendor rather than a company, so one intrusion propagates to everyone downstream who trusted the artefact.',
    horizon:
      'Provenance is becoming a procurement question: signed builds, verifiable dependencies and an answerable "what is in this thing" are moving from best practice toward contractual baseline, with AI-generated code adding a new source of unvetted dependencies.',
    mindset:
      'Trust artefacts, not authors - verify what you are actually running, and assume any dependency can become hostile at its next version.',
    skills: ['supply-chain-security', 'secure-sdlc', 'automation-engineering', 'third-party-risk'],
  },
  {
    id: 'cloud-saas',
    label: 'Cloud & SaaS Exposure',
    weight: 1.15,
    match: [
      /\b(aws|azure|gcp|google cloud|s3 bucket|blob storage|kubernetes|k8s|container|docker|terraform)\b[^.]{0,40}\b(exposed|misconfig|breach|vulnerab|attack|leak|escape)/i,
      /\b(saas (?:breach|security|risk)|tenant isolation|cross-tenant|shared responsibility)\b/i,
      /\b(salesforce|snowflake|workday|servicenow|slack|jira|zendesk|salesloft|drift)\b[^.]{0,40}\b(breach|compromis|data (?:theft|leak)|attack)/i,
      /\b(oauth (?:token|app|grant)|connected app|integration token)\b[^.]{0,30}\b(abuse|steal|compromis|revoke)/i,
      /\b(cloud (?:security|misconfiguration)|cspm|exposed (?:database|instance|elasticsearch|mongodb))\b/i,
    ],
    implication:
      'Data now sits in dozens of tenancies joined by machine-to-machine integrations, so a single compromised connector can expose many organisations at once without touching any of their own networks.',
    horizon:
      'Expect SaaS-to-SaaS integrations to be audited the way network connections once were, with organisations mapping which third-party apps hold live tokens into their data and pruning aggressively.',
    mindset:
      'Inventory the integrations, not just the servers: your attack surface includes every app someone connected with a click.',
    skills: ['cloud-security', 'identity-security', 'third-party-risk', 'security-architecture'],
  },
  {
    id: 'nation-state',
    label: 'Nation-State & Geopolitics',
    weight: 1.2,
    match: [
      /\b(nation-?state|state-?sponsored|state-?backed|government-?backed hacker)\b/i,
      /\b(apt\d+|apt-?c-?\d+|lazarus|kimsuky|sandworm|fancy bear|cozy bear|salt typhoon|volt typhoon|silk typhoon|mustang panda|turla|charming kitten|midnight blizzard)\b/i,
      /\b(espionage|cyber-?espionage|intelligence service|spy(?:ing)? campaign)\b/i,
      /\b(china|chinese|russia|russian|north korea|dprk|iran|iranian)\b[^.]{0,40}\b(hacker|threat actor|campaign|intrusion|espionage|operation)/i,
      /\b(sanction|indict|extradit|attribut)\w*\b[^.]{0,40}\b(hacker|cyber|intrusion|operator)/i,
    ],
    implication:
      'State-aligned intrusions are pre-positioning in infrastructure and stealing intellectual property with patient, low-signature tradecraft, which raises the bar from stopping noisy crime to noticing legitimate-looking activity over long periods.',
    horizon:
      'Geopolitical risk is likely to keep arriving as an engineering requirement - telecom, energy and logistics operators will be asked to demonstrate they could detect a quiet, resident adversary, not merely repel an obvious one.',
    mindset:
      'Hunt for presence rather than events: ask what a patient adversary who is already inside would look like in your telemetry.',
    skills: ['threat-intelligence', 'threat-hunting', 'detection-engineering', 'ot-security'],
  },
  {
    id: 'data-breach',
    label: 'Breaches & Data Privacy',
    weight: 1.05,
    match: [
      /\b(data breach|breach notification|records (?:exposed|stolen|leaked)|personal (?:data|information) (?:exposed|stolen)|pii (?:exposed|leak))\b/i,
      /\b(\d[\d.,]*\s*(?:million|billion)\s+(?:records|customers|users|accounts|people))\b/i,
      /\b(exposed database|unsecured (?:server|bucket|database)|data leak)\b/i,
      /\b(privacy (?:violation|regulator|fine|complaint)|gdpr|ccpa|dpa fine|data protection authority)\b/i,
      /\b(scrap(?:ed|ing) data|dark web (?:listing|sale)|selling (?:data|records))\b/i,
    ],
    implication:
      'Breach impact is compounding: the same identity data is stolen repeatedly and recombined, so each new leak raises the quality of everyone else\'s social engineering.',
    horizon:
      'Data minimisation is likely to become a security control rather than a compliance nicety, because the cheapest way to survive the next breach is to not be holding the data.',
    mindset:
      'Ask what you can delete. Retained data is a liability that accrues interest.',
    skills: ['privacy-engineering', 'data-governance', 'grc', 'incident-response'],
  },
  {
    id: 'regulation',
    label: 'Regulation & Accountability',
    weight: 1.05,
    match: [
      /\b(regulat\w+|directive|mandate|legislation|bill|rule)\b[^.]{0,40}\b(cyber|security|disclosure|incident|resilience)/i,
      /\b(nis2|dora|cra|cyber resilience act|sec (?:disclosure|cyber) rules?|binding operational directive|bod \d+-\d+|executive order)\b/i,
      /\b(fine[ds]?|penalt\w+|settlement|lawsuit|liab\w+)\b[^.]{0,40}\b(breach|security failure|data protection|cyber)/i,
      /\b(ciso|executive|board)\b[^.]{0,30}\b(liab\w+|prosecut\w+|accountab\w+|charged)/i,
      /\b(secure by design|secure by default) (?:pledge|commitment|principles)\b/i,
    ],
    implication:
      'Accountability is being pushed toward named individuals and product makers, which turns evidence - of decisions, timelines and known risk accepted - into a deliverable of the security function.',
    horizon:
      'Expect security work to be increasingly shaped by what can be demonstrated to a regulator or a court: documented risk decisions, provable timelines and defensible defaults shipped by vendors rather than configured by customers.',
    mindset:
      'Write down the decision and the reasoning. Security judgement is becoming a record, not a conversation.',
    skills: ['grc', 'security-communication', 'third-party-risk', 'security-architecture'],
  },
  {
    id: 'vuln-research',
    label: 'Vulnerability Research & Memory Safety',
    weight: 1.15,
    match: [
      /\b(fuzzing|fuzzer|symbolic execution|static analysis|variant analysis|root cause analysis|exploit(?:ation)? (?:chain|primitive|technique)|proof-of-concept exploit)\b/i,
      /\b(use-after-free|buffer overflow|out-of-bounds|type confusion|race condition|integer overflow|heap corruption|double free)\b/i,
      /\b(memory[- ]safe\w*|rust rewrite|written in rust|sandbox escape|mitigation bypass|cfi|mte|pointer authentication)\b/i,
      /\b(bug bounty|pwn2own|vulnerability research|security research(?:er)? (?:found|discovered|disclosed))\b/i,
      /\b(cve-\d{4}-\d+)\b/i,
    ],
    implication:
      'Offensive research keeps demonstrating that classes of bug - not individual bugs - are the real problem, and that the durable fixes are structural: safer languages, sandboxes and mitigations that kill whole techniques.',
    horizon:
      'Memory-safe rewrites of critical components and automated variant hunting look set to keep expanding, with AI-assisted discovery raising the volume of findings faster than most teams can triage them.',
    mindset:
      'Fix the class, not the instance - and treat "why was this bug possible" as the real deliverable of an incident.',
    skills: ['vulnerability-research', 'secure-coding', 'secure-sdlc', 'adversarial-testing'],
  },
  {
    id: 'ot-ics',
    label: 'OT, ICS & Critical Infrastructure',
    weight: 1.2,
    match: [
      /\b(ics|scada|operational technology|\bot\b security|plc|hmi|industrial control|building automation|bacnet|modbus)\b/i,
      /\b(critical infrastructure|water (?:utility|treatment)|power grid|energy sector|pipeline|rail|hospital|healthcare)\b[^.]{0,40}\b(attack|breach|advisory|vulnerab|intrusion|disrupt)/i,
      /\b(icsa-\d{2}-\d+|ics advisory|ics-cert)\b/i,
      /\b(medical device|iot device|firmware)\b[^.]{0,30}\b(vulnerab|flaw|advisory|exploit)/i,
    ],
    implication:
      'Physical-consequence systems are being pulled onto shared networks faster than they can be segmented, and advisories keep landing on equipment with decade-long patch cycles.',
    horizon:
      'The gap between IT security practice and plant reality is likely to be closed by compensating controls - segmentation, monitoring and safe-state engineering - rather than by patching, creating demand for people fluent in both worlds.',
    mindset:
      'Design for safe failure: when you cannot patch, constrain what the compromised device is able to cause.',
    skills: ['ot-security', 'security-architecture', 'resilience-engineering', 'threat-modeling'],
  },
  {
    id: 'crypto-pqc',
    label: 'Cryptography & Post-Quantum Migration',
    weight: 1.1,
    match: [
      /\b(post-?quantum|pqc|quantum-?safe|quantum-?resistant|ml-kem|kyber|dilithium|harvest now decrypt later)\b/i,
      /\b(encryption|cryptograph\w+|cipher|tls|certificate authority|pki|hsm|key management)\b[^.]{0,40}\b(weak|broken|flaw|migrat|deprecat|mandate|backdoor)/i,
      /\b(end-to-end encryption|e2ee|lawful access|encryption backdoor|client-side scanning)\b/i,
      /\b(certificate (?:lifetime|expiry|misissuance|revocation)|47-day certificate|crypto-?agility)\b/i,
    ],
    implication:
      'Cryptographic change is becoming an operational programme: shorter certificate lifetimes, algorithm migrations and legal pressure on end-to-end encryption all demand the ability to swap primitives without downtime.',
    horizon:
      'Crypto-agility - knowing every place you use cryptography and being able to change it on demand - is likely to become a named capability, driven by the post-quantum timeline and by automation-forcing certificate lifetimes.',
    mindset:
      'Treat every algorithm and certificate as temporary, and build the inventory before the deadline arrives.',
    skills: ['applied-cryptography', 'automation-engineering', 'security-architecture', 'asset-inventory'],
  },
  {
    id: 'social-insider',
    label: 'Social Engineering & Insider Risk',
    weight: 1.2,
    match: [
      /\b(social engineering|pretext|vishing|smishing|help ?desk (?:fraud|social)|sim swap|business email compromise|bec)\b/i,
      /\b(insider (?:threat|risk)|rogue employee|malicious insider)\b/i,
      /\b(fake (?:it worker|job|recruiter|candidate|interview)|north korean it worker|laptop farm)\b/i,
      /\b(phishing (?:campaign|kit|page|email)|spear ?phishing|quishing|qr code phish|callback phish|adversary-in-the-middle)\b/i,
      /\b(mfa reset|account recovery abuse|impersonat\w+ (?:staff|employee|executive|support))\b/i,
    ],
    implication:
      'The reliable way in is still a person with a legitimate path to access, and process gaps - help-desk resets, contractor onboarding, recovery flows - are being attacked as deliberately as software bugs.',
    horizon:
      'Verification of humans is set to get harder as synthetic voice and video become routine, pushing organisations toward cryptographic or out-of-band identity proofing for any high-impact request.',
    mindset:
      'Threat-model your processes, not only your systems: ask who can talk their way into the outcome an attacker wants.',
    skills: ['security-awareness-design', 'identity-security', 'threat-modeling', 'incident-response'],
  },
  {
    id: 'detection-ops',
    label: 'Detection, Response & Security Operations',
    weight: 1.1,
    match: [
      /\b(soc|security operations|detection engineering|threat hunt\w*|incident response|dfir|forensics|tabletop exercise)\b/i,
      /\b(siem|edr|xdr|ndr|telemetry|log (?:retention|source|ingestion)|sigma rule|detection rule|mitre att&?ck)\b/i,
      /\b(dwell time|mean time to (?:detect|respond)|alert fatigue|false positive|triage backlog|analyst burnout)\b/i,
      /\b(living[- ]off[- ]the[- ]land|lotl|fileless|edr (?:bypass|killer)|defense evasion|log tampering|anti-?forensic)\b/i,
      /\b(purple team|red team (?:exercise|engagement)|breach and attack simulation)\b/i,
    ],
    implication:
      'Defenders are being asked to find activity that looks native to the environment, which moves the craft from matching known-bad signatures to reasoning about what is normal for this specific estate.',
    horizon:
      'Detection is likely to keep becoming a software engineering discipline - rules as code, tested and version-controlled - with analyst time redirected from triage toward building the automation that does the triage.',
    mindset:
      'Baseline your own environment first: detection quality now depends more on knowing normal than on knowing malware.',
    skills: ['detection-engineering', 'threat-hunting', 'automation-engineering', 'data-analysis'],
  },
  {
    id: 'endpoint-mobile',
    label: 'Endpoint, Mobile & Browser',
    weight: 1.0,
    match: [
      /\b(mobile spyware|commercial spyware|mercenary spyware|pegasus|predator|stalkerware|zero-click)\b/i,
      /\b(android|ios|iphone|chrome|firefox|safari|edge)\b[^.]{0,40}\b(vulnerab|exploit|patch|update|flaw|malware|spyware)/i,
      /\b(browser extension|malicious extension|sideload|app store (?:malware|removal)|adware|rootkit|bootkit|uefi)\b/i,
      /\b(byod|unmanaged device|endpoint (?:hardening|protection|compromise))\b/i,
    ],
    implication:
      'The endpoint is now a browser plus a set of extensions and AI helpers, and each of those is an untrusted-content processor sitting inside the user\'s session.',
    horizon:
      'Browser security is likely to be managed as its own control plane - extension allowlisting, profile isolation and policy for AI assistants - rather than folded into generic endpoint management.',
    mindset:
      'Treat the browser as the operating system that matters, and audit what you have installed into it.',
    skills: ['endpoint-security', 'detection-engineering', 'security-architecture', 'asset-inventory'],
  },
  {
    id: 'cybercrime-economy',
    label: 'Cybercrime Economy & Disruption',
    weight: 1.0,
    match: [
      /\b(arrest\w*|charged|indict\w*|sentenc\w*|extradit\w*|guilty plea|takedown|seiz\w+ (?:domain|server|infrastructure)|disrupt\w+ operation)\b/i,
      /\b(law enforcement|europol|interpol|fbi|doj|national crime agency|operation \w+)\b[^.]{0,40}\b(cyber|hacker|ransomware|fraud|market)/i,
      /\b(dark ?(?:web|market)|initial access broker|bulletproof hosting|money launder\w*|crypto(?:currency)? (?:theft|laundering|mixer)|drainer)\b/i,
      /\b(bulletproof|cybercrime (?:forum|service|ecosystem)|malware-as-a-service|phishing-as-a-service)\b/i,
    ],
    implication:
      'Enforcement is landing more often on the infrastructure and the intermediaries, but capability re-forms quickly, so disruption changes the cost of attacking rather than removing the threat.',
    horizon:
      'Expect more public attribution and infrastructure seizure alongside faster re-branding by crews, which makes tracking capability - and the services they rent - more useful than tracking group names.',
    mindset:
      'Follow the economics: understand what your adversary must buy, and which of those costs you can raise.',
    skills: ['threat-intelligence', 'osint-investigation', 'fraud-analytics', 'security-communication'],
  },
  {
    id: 'network-ddos',
    label: 'Network Infrastructure & Availability',
    weight: 0.95,
    match: [
      /\b(ddos|denial of service|botnet|amplification|record-breaking attack|tbps|traffic flood)\b/i,
      /\b(bgp|dns (?:hijack|poison|tunnel)|routing (?:leak|hijack)|rpki|subsea cable|internet outage|cdn outage)\b/i,
      /\b(mirai|aisuru|residential proxy|proxy network|compromised router|iot botnet)\b/i,
      /\b(resilien\w+|availability|single point of failure|concentration risk)\b[^.]{0,40}\b(internet|cloud|provider|outage)/i,
    ],
    implication:
      'Availability is being attacked at record volumes from compromised consumer devices, and concentration in a handful of providers means one outage now propagates across unrelated businesses.',
    horizon:
      'Concentration risk is likely to become a board-level topic in its own right, with organisations asked to show they can operate - degraded but functioning - without a single dominant provider.',
    mindset:
      'Ask what happens when a dependency you do not control disappears, and make degraded operation a designed state rather than an emergency.',
    skills: ['resilience-engineering', 'network-security', 'security-architecture', 'third-party-risk'],
  },
  {
    id: 'workforce',
    label: 'Workforce, Skills & Burnout',
    weight: 1.05,
    match: [
      /\b(skills? (?:gap|shortage|crisis)|talent (?:shortage|pipeline|war)|hiring|layoffs?|workforce|staffing|headcount)\b[^.]{0,40}\b(cyber|security|soc|analyst)/i,
      /\b(burnout|stress|attrition|turnover|retention)\b[^.]{0,30}\b(security|analyst|ciso|team)/i,
      /\b(certification|training|upskill\w*|apprenticeship|career (?:path|change))\b[^.]{0,30}\b(cyber|security)/i,
      /\b(ciso (?:role|report|survey|tenure)|security budget|budget (?:cut|increase|pressure))\b/i,
    ],
    implication:
      'Teams are being asked to cover more surface with flat headcount, which is pushing the role toward leverage - automation, platform work and clear prioritisation - and away from manual coverage.',
    horizon:
      'Hiring is likely to keep favouring engineers who can build defences over operators who can only run tools, with communication and prioritisation treated as core technical skills rather than soft ones.',
    mindset:
      'Optimise for leverage: prefer work that removes a class of toil over work that clears today\'s queue.',
    skills: ['automation-engineering', 'security-communication', 'risk-prioritisation', 'secure-sdlc'],
  },
];

/**
 * Skills referenced by themes. `demandDriver` explains why the current news
 * pattern creates the demand; `evidence` is filled in at render time from the
 * stories that actually matched.
 */
export const SKILLS = {
  'ai-security': {
    label: 'AI / LLM security engineering',
    demandDriver: 'Securing systems whose inputs are untrusted natural language and whose behaviour is probabilistic.',
    practice: 'Learn agent architectures end to end, then attack them: tool permissions, context boundaries, output handling, and what the model is allowed to do without a human.',
  },
  'prompt-injection-defense': {
    label: 'Prompt injection & agent containment',
    demandDriver: 'Agentic features that read untrusted web content are shipping into browsers and enterprise tools faster than the defences for them.',
    practice: 'Build a deliberately vulnerable agent, break it, then practise the mitigations: input provenance, least-privilege tools, human confirmation on irreversible actions.',
  },
  'ai-governance': {
    label: 'AI assurance & governance',
    demandDriver: 'Organisations need an inventory of models and agents, and defensible evidence that each was assessed.',
    practice: 'Work through a recognised AI risk framework against a real internal system, and produce the artefacts an auditor would ask for.',
  },
  'identity-security': {
    label: 'Identity & access engineering',
    demandDriver: 'Most reported intrusions now proceed through valid credentials, tokens or over-permissioned machine identities.',
    practice: 'Get fluent in one identity provider deeply - conditional access, token lifetimes, OAuth grant abuse, service principals - then audit a real tenant.',
  },
  'zero-trust-architecture': {
    label: 'Zero-trust & authorisation design',
    demandDriver: 'Perimeter compromise is assumed, so authorisation has to be continuous and contextual rather than positional.',
    practice: 'Redesign one internal service so that network location grants nothing, and measure what breaks.',
  },
  'cloud-security': {
    label: 'Cloud & SaaS security',
    demandDriver: 'Data and machine identities live across many tenancies joined by integrations nobody inventoried.',
    practice: 'Map every third-party app with a live token into one production SaaS estate, and justify each one.',
  },
  'detection-engineering': {
    label: 'Detection engineering',
    demandDriver: 'Adversary activity resembles legitimate administration, so detection has to be authored, tested and tuned per environment.',
    practice: 'Write detections as code against real telemetry, validate them with emulated attacks, and keep them in version control with tests.',
  },
  'threat-hunting': {
    label: 'Threat hunting',
    demandDriver: 'Patient, low-signature intrusions are found by hypothesis-driven search, not by alerts.',
    practice: 'Run structured hunts from a specific hypothesis and a specific data source; document what normal looked like.',
  },
  'incident-response': {
    label: 'Incident response & digital forensics',
    demandDriver: 'Extortion and edge-device compromise put a premium on fast, evidenced containment and credible reconstruction.',
    practice: 'Work timeline reconstruction on real artefacts, and rehearse the coordination, not just the tooling.',
  },
  'vulnerability-management': {
    label: 'Vulnerability & patch operations',
    demandDriver: 'Exploitation now follows disclosure within hours, making patch latency a measured operational capability.',
    practice: 'Instrument time-to-patch for internet-facing assets and drive it down; treat exceptions as tracked risk.',
  },
  'exposure-management': {
    label: 'Exposure & attack surface management',
    demandDriver: 'You cannot defend an internet-facing estate you cannot enumerate continuously.',
    practice: 'Build continuous external discovery for one organisation and reconcile it against the asset system of record.',
  },
  'supply-chain-security': {
    label: 'Software supply chain security',
    demandDriver: 'Compromise arrives through dependencies, build systems and vendors rather than direct attack.',
    practice: 'Add provenance and signature verification to one real pipeline, and produce an SBOM you would stake a release on.',
  },
  'secure-sdlc': {
    label: 'Secure SDLC & platform guardrails',
    demandDriver: 'Scale demands defaults that make the safe path the easy path, especially as more code is machine-generated.',
    practice: 'Ship one paved-road control - a secure template, a policy check in CI - and measure adoption rather than findings.',
  },
  'secure-coding': {
    label: 'Secure coding & memory safety',
    demandDriver: 'Whole bug classes are being designed out of critical software, and reviewers who understand why are scarce.',
    practice: 'Read real CVE root causes in C/C++ code, then reimplement the vulnerable component in a memory-safe language.',
  },
  'vulnerability-research': {
    label: 'Vulnerability research & exploit analysis',
    demandDriver: 'Structural fixes depend on people who can find variants and explain the underlying primitive.',
    practice: 'Pick one target, build a fuzzing harness, and triage crashes through to root cause.',
  },
  'adversarial-testing': {
    label: 'Adversarial testing & red teaming',
    demandDriver: 'Controls - including AI guardrails - are only credible once someone has tried seriously to defeat them.',
    practice: 'Run scoped adversarial exercises with explicit objectives and written findings a defender can act on.',
  },
  'threat-modeling': {
    label: 'Threat modelling',
    demandDriver: 'New architectures - agents, OT convergence, SaaS integrations - have no inherited playbook to copy.',
    practice: 'Threat model one system per week in an hour, and track which mitigations actually shipped.',
  },
  'threat-intelligence': {
    label: 'Threat intelligence analysis',
    demandDriver: 'Attribution, campaign tracking and the economics of criminal services drive defensive prioritisation.',
    practice: 'Produce short intelligence assessments with explicit confidence levels and a recommended action.',
  },
  'osint-investigation': {
    label: 'OSINT & investigation',
    demandDriver: 'Fraud, fake personnel and criminal infrastructure are traced through open sources and disciplined pivoting.',
    practice: 'Work published investigations backwards from their conclusions to learn the pivots.',
  },
  'automation-engineering': {
    label: 'Security automation & engineering',
    demandDriver: 'Flat headcount against growing surface makes tooling and pipelines the only route to coverage.',
    practice: 'Automate one recurring manual task per month, and retire the runbook it replaces.',
  },
  'ot-security': {
    label: 'OT / ICS security',
    demandDriver: 'Physical-consequence systems are networked, rarely patchable and increasingly in scope for regulation.',
    practice: 'Learn the protocols and the safety mindset, then design segmentation and monitoring for one process cell.',
  },
  'applied-cryptography': {
    label: 'Applied cryptography & crypto-agility',
    demandDriver: 'Post-quantum migration and shrinking certificate lifetimes turn cryptography into an operations problem.',
    practice: 'Inventory cryptographic use in one system and rehearse swapping an algorithm or rotating a CA.',
  },
  'privacy-engineering': {
    label: 'Privacy engineering',
    demandDriver: 'Repeated breaches of the same identity data make minimisation and purpose limits into security controls.',
    practice: 'Map data flows for one product and delete something; prove nothing depended on it.',
  },
  'data-governance': {
    label: 'Data governance',
    demandDriver: 'You cannot protect, minimise or report on data whose location and ownership are unknown.',
    practice: 'Classify one critical data domain end to end and assign an accountable owner.',
  },
  'grc': {
    label: 'Risk, compliance & evidence',
    demandDriver: 'Regulators and courts increasingly ask for demonstrable decisions, timelines and defensible defaults.',
    practice: 'Turn one control from an assertion into automatically collected evidence.',
  },
  'third-party-risk': {
    label: 'Third-party & vendor risk',
    demandDriver: 'Downstream exposure follows vendors and integrations, not org charts.',
    practice: 'Rank vendors by the access they actually hold, then review the top few properly instead of everyone shallowly.',
  },
  'resilience-engineering': {
    label: 'Resilience & recovery engineering',
    demandDriver: 'Extortion, outages and provider concentration make degraded-but-operating a design requirement.',
    practice: 'Rehearse recovery of one critical service end to end, and record how long it truly took.',
  },
  'tabletop-facilitation': {
    label: 'Crisis exercise facilitation',
    demandDriver: 'The costly decisions in extortion cases are business and legal, so they need rehearsing before the event.',
    practice: 'Facilitate a tabletop with executives, not engineers, and capture the decisions they struggled with.',
  },
  'security-awareness-design': {
    label: 'Human-risk & process design',
    demandDriver: 'Attacks succeed through help-desk resets, onboarding gaps and recovery flows rather than user ignorance.',
    practice: 'Redesign one high-risk process so the safe outcome does not depend on a person being suspicious.',
  },
  'endpoint-security': {
    label: 'Endpoint & browser security',
    demandDriver: 'The browser plus its extensions and AI assistants is where untrusted content meets the user session.',
    practice: 'Inventory extensions across a fleet and build an allowlisting policy people can live with.',
  },
  'network-security': {
    label: 'Network & infrastructure security',
    demandDriver: 'Routing, DNS and availability attacks scale from compromised consumer devices at record volume.',
    practice: 'Learn how your traffic is actually routed and what fails when a provider or path disappears.',
  },
  'security-architecture': {
    label: 'Security architecture',
    demandDriver: 'Structural choices - isolation, blast radius, defaults - decide outcomes more than added controls.',
    practice: 'Review one system for blast radius and change a default rather than adding a detection.',
  },
  'asset-inventory': {
    label: 'Asset & dependency inventory',
    demandDriver: 'Almost every current pressure - exposure, crypto migration, AI usage - starts with an accurate inventory.',
    practice: 'Build one authoritative inventory with automated reconciliation and a named owner.',
  },
  'data-analysis': {
    label: 'Data analysis for security',
    demandDriver: 'Finding native-looking activity is a data problem before it is a tooling problem.',
    practice: 'Work with raw telemetry directly - query it, chart it, learn its gaps and its normal.',
  },
  'fraud-analytics': {
    label: 'Fraud & abuse analytics',
    demandDriver: 'Synthetic identity, account takeover and scam infrastructure sit between security and fraud teams.',
    practice: 'Study an abuse pattern end to end and propose a control measured by loss rate, not alert count.',
  },
  'risk-prioritisation': {
    label: 'Risk prioritisation',
    demandDriver: 'More surface than capacity means the decisive skill is choosing what not to do, defensibly.',
    practice: 'Force-rank your backlog by plausible impact and write down what you are accepting.',
  },
  'security-communication': {
    label: 'Communicating security to decision-makers',
    demandDriver: 'Accountability has moved toward executives, who need technical reality translated into decisions.',
    practice: 'Write one page that leads with the decision needed and the consequence of delay.',
  },
};
