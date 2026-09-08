import { firecrawl } from "../utils/firecrawl";

export interface InterviewSource {
  url: string;
  title: string;
  description: string;
  score: number;
  source_type: string;
}

export interface InterviewResearch {
  found: boolean;
  queries: string[];
  sources: InterviewSource[];
  note: string;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function sourceQualityScore(url: string): number {
  const value = url.toLowerCase();

  if (value.includes("glassdoor.")) return 12;
  if (value.includes("ambitionbox.")) return 12;
  if (value.includes("reddit.com")) return 10;
  if (value.includes("teamblind.com")) return 10;
  if (value.includes("leetcode.com/discuss")) return 10;

  if (value.includes("medium.com")) return 5;
  if (value.includes("substack.com")) return 5;

  // Usually not interview-experience sources
  if (value.includes("linkedin.com/in/")) return -12;
  if (value.includes("instagram.com")) return -15;
  if (value.includes("naukri.com")) return -8;
  if (value.includes("indeed.com/jobs")) return -8;

  return 0;
}

function scoreResult(
  companyName: string,
  title: string,
  description: string,
  url: string
): number {
  const company = normalize(companyName);

  const titleText = normalize(title);
  const descriptionText = normalize(description);

  const combined = `${titleText} ${descriptionText}`;

  // Company must actually appear.
  const companyMentioned =
    titleText.includes(company) ||
    descriptionText.includes(company);

  if (!companyMentioned) {
    return 0;
  }

  const strongInterviewTerms = [
    "interview process",
    "interview experience",
    "interview questions",
    "technical interview",
    "coding interview",
    "system design interview",
    "behavioural interview",
    "behavioral interview",
    "hiring process",
    "recruitment process",
    "interview rounds",
    "interview round",
    "take home assignment",
    "take home",
  ];

  const weakInterviewTerms = [
    "interview",
    "hiring",
    "candidate",
    "recruitment",
  ];

  const hasStrongSignal = strongInterviewTerms.some((term) =>
    combined.includes(term)
  );

  const hasWeakSignal = weakInterviewTerms.some((term) =>
    combined.includes(term)
  );

  // Random company mentions are useless.
  if (!hasStrongSignal && !hasWeakSignal) {
    return 0;
  }

  let score = 0;

  // Company relevance
  if (titleText.includes(company)) {
    score += 10;
  }

  if (descriptionText.includes(company)) {
    score += 6;
  }

  // Interview relevance
  for (const term of strongInterviewTerms) {
    if (combined.includes(term)) {
      score += 5;
    }
  }

  if (!hasStrongSignal && hasWeakSignal) {
    score += 2;
  }

  // Source credibility / usefulness
  score += sourceQualityScore(url);

  return score;
}

export async function researchInterviewProcess(
  companyName: string
): Promise<InterviewResearch> {
  const queries = [
    `"${companyName}" software engineer interview experience`,
    `"${companyName}" interview process hiring rounds`,
  ];

  try {
    const allResults: any[] = [];

    for (const query of queries) {
      const result = await firecrawl.search(query, {
        limit: 8,
      });

      if (result.web) {
        allResults.push(...result.web);
      }
    }

    // Remove duplicate URLs
    const unique = new Map<string, any>();

    for (const item of allResults) {
      if (!item?.url) continue;

      if (!unique.has(item.url)) {
        unique.set(item.url, item);
      }
    }

    const ranked: InterviewSource[] = [...unique.values()]
      .map((item) => {
        const url = item.url ?? "";
        const title = item.title ?? "";
        const description = item.description ?? "";

        return {
          url,
          title,
          description,
          score: scoreResult(
            companyName,
            title,
            description,
            url
          ),
          source_type: getSourceType(url),
        };
      })
      .filter((item) => item.score >= 15)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (ranked.length === 0) {
      return {
        found: false,
        queries,
        sources: [],
        note: `No reliable public discussion of ${companyName}'s interview process was found.`,
      };
    }

    return {
      found: true,
      queries,
      sources: ranked,
      note: `Found ${ranked.length} potentially useful public interview sources for ${companyName}.`,
    };
  } catch (error) {
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