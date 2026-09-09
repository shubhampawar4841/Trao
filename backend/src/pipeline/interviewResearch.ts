import { firecrawl } from "../utils/firecrawl";

export interface InterviewSource {
  url: string;
  title: string;
  description: string;
  score: number;
  source_type: string;

  // Actual evidence found inside the page.
  evidence: string[];
}

export interface InterviewResearch {
  found: boolean;
  queries: string[];
  sources: InterviewSource[];
  note: string;
}

interface SearchHit {
  url: string;
  title: string;
  description: string;
  snippetScore: number;
  source_type: string;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getHostname(value: string): string {
  try {
    return new URL(value)
      .hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function canonicalizeUrl(value: string): string {
  try {
    const url = new URL(value);

    url.hash = "";

    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ].forEach((key) =>
      url.searchParams.delete(key)
    );

    return url.toString();
  } catch {
    return value;
  }
}

function getSourceType(url: string): string {
  const value = url.toLowerCase();

  if (value.includes("glassdoor.")) return "glassdoor";
  if (value.includes("ambitionbox.")) return "ambitionbox";
  if (value.includes("reddit.com")) return "reddit";
  if (value.includes("teamblind.com")) return "blind";
  if (value.includes("leetcode.com")) return "leetcode";
  if (value.includes("medium.com")) return "blog";
  if (value.includes("substack.com")) return "blog";

  return "web";
}

function isTrustedInterviewPlatform(
  sourceType: string
): boolean {
  return [
    "glassdoor",
    "ambitionbox",
    "reddit",
    "blind",
    "leetcode",
  ].includes(sourceType);
}

/**
 * Terms that strongly indicate this page is
 * actually discussing a hiring interview.
 */
const HIRING_TERMS = [
  "interview process",
  "interview experience",
  "hiring process",
  "recruitment process",
  "interview rounds",
  "interview round",
  "technical round",
  "coding round",
  "technical interview",
  "coding interview",
  "system design interview",
  "behavioral interview",
  "behavioural interview",
  "screening round",
  "recruiter screen",
  "phone screen",
  "take home assignment",
  "take-home assignment",
  "take home test",
  "coding assessment",
  "online assessment",
  "candidate experience",
  "i interviewed at",
  "interviewed at",
  "applied for",
];

function hasExactCompanyMention(
  text: string,
  companyName: string
): boolean {
  const escaped = companyName
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(
    `(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`,
    "i"
  ).test(text);
}

/**
 * Find small excerpts around genuine hiring terms.
 *
 * These are what we can later feed to the LLM,
 * rather than giving it the whole noisy webpage.
 */
function extractEvidence(
  markdown: string
): string[] {
  if (!markdown) return [];

  const lines = markdown
    .split("\n")
    .map((line) =>
      line
        .replace(/[#>*_`]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);

  const evidence: string[] = [];

  for (const line of lines) {
    const normalizedLine = normalize(line);

    const relevant = HIRING_TERMS.some(
      (term) =>
        normalizedLine.includes(term)
    );

    if (!relevant) continue;

    // Avoid huge chunks.
    const snippet =
      line.length > 350
        ? `${line.slice(0, 347)}...`
        : line;

    if (!evidence.includes(snippet)) {
      evidence.push(snippet);
    }

    if (evidence.length >= 3) {
      break;
    }
  }

  return evidence;
}

/**
 * Cheap pre-filter using only search snippets.
 * Used to decide which pages are worth scraping.
 */
function scoreSnippetCandidate(input: {
  companyName: string;
  companyUrl: string;
  url: string;
  title: string;
  description: string;
}): number {
  const {
    companyName,
    companyUrl,
    url,
    title,
    description,
  } = input;

  const companyDomain = getHostname(companyUrl);
  const resultDomain = getHostname(url);

  if (
    !resultDomain ||
    resultDomain === companyDomain ||
    resultDomain.endsWith(`.${companyDomain}`)
  ) {
    return 0;
  }

  const combined = `${title}\n${description}`;
  const normalizedCombined = normalize(combined);

  const companyInTitle =
    hasExactCompanyMention(title, companyName);

  const domainMentioned =
    companyDomain.length > 0 &&
    combined.toLowerCase().includes(companyDomain);

  if (!companyInTitle && !domainMentioned) {
    return 0;
  }

  const strongHiringSignal =
    HIRING_TERMS.some((term) =>
      normalizedCombined.includes(term)
    );

  const weakHiringSignal =
    ["interview", "hiring", "recruiter", "candidate"]
      .some((term) =>
        normalizedCombined.includes(term)
      );

  if (!strongHiringSignal && !weakHiringSignal) {
    return 0;
  }

  let score = 0;

  if (companyInTitle) score += 30;
  if (domainMentioned) score += 20;
  if (strongHiringSignal) score += 25;
  if (weakHiringSignal) score += 5;

  const sourceType = getSourceType(url);

  if (isTrustedInterviewPlatform(sourceType)) {
    score += 15;
  }

  return score;
}

function evaluateResult(input: {
  companyName: string;
  companyUrl: string;
  roleTitle: string;

  url: string;
  title: string;
  description: string;
  markdown: string;
}): InterviewSource | null {
  const {
    companyName,
    companyUrl,
    url,
    title,
    description,
    markdown,
  } = input;

  const sourceType = getSourceType(url);

  const companyDomain = getHostname(companyUrl);
  const resultDomain = getHostname(url);

  // Own company website is already handled by company crawl.
  if (
    resultDomain === companyDomain ||
    resultDomain.endsWith(`.${companyDomain}`)
  ) {
    return null;
  }

  const combined = `
${title}
${description}
${markdown}
`;

  const normalizedCombined = normalize(combined);

  const companyInTitle =
    hasExactCompanyMention(
      title,
      companyName
    );

  const domainMentioned =
    companyDomain.length > 0 &&
    combined
      .toLowerCase()
      .includes(companyDomain);

  const strongHiringSignal =
    HIRING_TERMS.some((term) =>
      normalizedCombined.includes(term)
    );

  /*
   * SIMPLE RULE:
   *
   * Must clearly identify company
   * AND
   * must clearly discuss hiring/interviews.
   */
  if (
    (!companyInTitle && !domainMentioned) ||
    !strongHiringSignal
  ) {
    return null;
  }

  const evidence =
    extractEvidence(markdown);

  if (evidence.length === 0) {
    return null;
  }

  let score = 0;

  if (companyInTitle) score += 30;
  if (domainMentioned) score += 30;
  if (strongHiringSignal) score += 20;

  if (isTrustedInterviewPlatform(sourceType)) {
    score += 10;
  }

  score += Math.min(
    evidence.length * 5,
    15
  );

  return {
    url,
    title,
    description,
    score,
    source_type: sourceType,
    evidence,
  };
}

async function searchCandidates(
  query: string,
  companyName: string,
  companyUrl: string
): Promise<{
  hits: SearchHit[];
  creditsUsed: number;
}> {
  const companyDomain = getHostname(companyUrl);

  console.log(`Interview research search: ${query}`);

  const searchResult = await firecrawl.search(
    query,
    {
      limit: 5,

      excludeDomains: [
        companyDomain,
        "linkedin.com",
        "facebook.com",
        "instagram.com",
        "scribd.com",
      ].filter(Boolean),

      ignoreInvalidURLs: true,
    }
  );

  const creditsUsed =
    (searchResult as any).creditsUsed ?? 2;

  const unique = new Map<string, SearchHit>();

  for (const item of searchResult.web ?? []) {
    if (!item?.url) continue;

    const url = canonicalizeUrl(item.url);
    const title = item.title ?? "";
    const description = item.description ?? "";

    const snippetScore = scoreSnippetCandidate({
      companyName,
      companyUrl,
      url,
      title,
      description,
    });

    if (snippetScore <= 0) {
      continue;
    }

    if (!unique.has(url)) {
      unique.set(url, {
        url,
        title,
        description,
        snippetScore,
        source_type: getSourceType(url),
      });
    }
  }

  const hits = [...unique.values()].sort(
    (a, b) => b.snippetScore - a.snippetScore
  );

  return {
    hits,
    creditsUsed,
  };
}

async function scrapeAndVerify(
  candidates: SearchHit[],
  companyName: string,
  companyUrl: string,
  roleTitle: string
): Promise<{
  sources: InterviewSource[];
  creditsUsed: number;
}> {
  const sources: InterviewSource[] = [];
  let creditsUsed = 0;

  for (const candidate of candidates) {
    try {
      console.log(
        `Interview research scrape: ${candidate.url}`
      );

      const page = await firecrawl.scrape(
        candidate.url,
        {
          formats: ["markdown"],
          onlyMainContent: true,
        }
      );

      creditsUsed +=
        (page as any).creditsUsed ?? 1;

      const markdown =
        typeof (page as any).markdown === "string"
          ? (page as any).markdown
          : "";

      const source = evaluateResult({
        companyName,
        companyUrl,
        roleTitle,
        url: candidate.url,
        title:
          candidate.title ||
          (page as any).metadata?.title ||
          "",
        description: candidate.description,
        markdown,
      });

      if (source) {
        sources.push(source);
      }
    } catch (error) {
      console.warn(
        `Interview scrape failed: ${candidate.url}`,
        error instanceof Error
          ? error.message
          : error
      );
    }
  }

  sources.sort((a, b) => b.score - a.score);

  return {
    sources,
    creditsUsed,
  };
}

export async function researchInterviewProcess(
  companyName: string,
  companyUrl: string,
  roleTitle = ""
): Promise<InterviewResearch> {
  const primaryQuery =
    `"${companyName}" "${roleTitle}" interview experience`;

  const fallbackQuery =
    `"${companyName}" hiring process interview`;

  const queries = [primaryQuery];
  let firecrawlCredits = 0;

  try {
    /*
     * LOW-CREDIT FLOW
     *
     * 1. Search snippets only (no scrape)
     * 2. Locally rank candidates
     * 3. Scrape ONLY the top 2 URLs
     * 4. Fallback to one more search if needed
     */
    let {
      hits,
      creditsUsed: searchCredits,
    } = await searchCandidates(
      primaryQuery,
      companyName,
      companyUrl
    );

    firecrawlCredits += searchCredits;

    if (hits.length === 0) {
      queries.push(fallbackQuery);

      const fallback = await searchCandidates(
        fallbackQuery,
        companyName,
        companyUrl
      );

      firecrawlCredits += fallback.creditsUsed;
      hits = fallback.hits;
    }

    const topCandidates = hits.slice(0, 2);

    console.log(
      `Interview research candidates to scrape: ${topCandidates.length}`
    );

    let {
      sources,
      creditsUsed: scrapeCredits,
    } = await scrapeAndVerify(
      topCandidates,
      companyName,
      companyUrl,
      roleTitle
    );

    firecrawlCredits += scrapeCredits;

    /*
     * Adaptive fallback:
     * if the first query produced candidates that
     * failed page verification, try one more search.
     */
    if (
      sources.length === 0 &&
      !queries.includes(fallbackQuery)
    ) {
      queries.push(fallbackQuery);

      const fallback = await searchCandidates(
        fallbackQuery,
        companyName,
        companyUrl
      );

      firecrawlCredits += fallback.creditsUsed;

      const fallbackCandidates =
        fallback.hits.slice(0, 2);

      const verified = await scrapeAndVerify(
        fallbackCandidates,
        companyName,
        companyUrl,
        roleTitle
      );

      firecrawlCredits += verified.creditsUsed;
      sources = verified.sources;
    }

    console.log(
      `Firecrawl interview research credits: ${firecrawlCredits}`
    );

    console.log(
      "\nVerified interview evidence:"
    );

    for (const source of sources) {
      console.log(
        `${source.score} | ${source.source_type} | ${source.title}`
      );

      for (const evidence of source.evidence) {
        console.log(`  ↳ ${evidence}`);
      }
    }

    if (sources.length === 0) {
      return {
        found: false,
        queries,
        sources: [],

        note:
          `No reliable public discussion of ${companyName}'s interview process was found. ` +
          `Interview details will not be inferred.`,
      };
    }

    return {
      found: true,
      queries,
      sources: sources.slice(0, 5),

      note:
        `Found ${sources.length} verified public source${
          sources.length === 1 ? "" : "s"
        } discussing ${companyName}'s interview or hiring process.`,
    };
  } catch (error) {
    console.log(
      `Firecrawl interview research credits: ${firecrawlCredits}`
    );

    return {
      found: false,
      queries,
      sources: [],

      note:
        error instanceof Error
          ? `Public interview research could not be completed: ${error.message}`
          : "Public interview research could not be completed.",
    };
  }
}
