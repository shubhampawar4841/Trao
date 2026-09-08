import { firecrawl } from "../utils/firecrawl";

export interface InterviewSource {
  url: string;
  title: string;
  description: string;
  score: number;
}

export interface InterviewResearch {
  found: boolean;
  query: string;
  sources: InterviewSource[];
  note: string;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
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
  const urlText = normalize(url);

  let score = 0;

  if (titleText.includes(company)) score += 10;
  if (descriptionText.includes(company)) score += 6;
  if (urlText.includes(company.replace(/\s+/g, ""))) score += 4;

  const interviewTerms = [
    "interview",
    "hiring",
    "recruitment",
    "candidate",
    "take home",
    "technical round",
    "coding round",
    "system design",
  ];

  const combined = `${titleText} ${descriptionText}`;

  for (const term of interviewTerms) {
    if (combined.includes(term)) {
      score += 2;
    }
  }

  return score;
}

export async function researchInterviewProcess(
  companyName: string
): Promise<InterviewResearch> {
  const query =
    `"${companyName}" software engineer interview process hiring experience`;

  try {
    const result = await firecrawl.search(query, {
      limit: 10,
    });

    const webResults = result.web ?? [];

    const ranked = webResults
      .map((item: any) => {
        const title = item.title ?? "";
        const description = item.description ?? "";
        const url = item.url ?? "";

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
        };
      })
      .filter((item) => item.url && item.score >= 8)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (ranked.length === 0) {
      return {
        found: false,
        query,
        sources: [],
        note: `No sufficiently relevant public discussion of ${companyName}'s interview process was found.`,
      };
    }

    return {
      found: true,
      query,
      sources: ranked,
      note: `Found ${ranked.length} potentially relevant public sources.`,
    };
  } catch (error) {
    return {
      found: false,
      query,
      sources: [],
      note:
        error instanceof Error
          ? `Interview research failed: ${error.message}`
          : "Interview research failed.",
    };
  }
}