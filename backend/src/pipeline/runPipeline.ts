import { extractRequirements } from "./extractRequirements";
import { crawlCompany } from "./crawlCompany";
import { generateCompanyBrief } from "./generateCompanyBrief";
import { generateAllQuestions } from "./generateQuestions";
import { ensureCoverage } from "./ensureCoverage";
import { generateFlashcards } from "./generateFlashcards";
import { buildSchedule } from "./schedule";
import { researchInterviewProcess } from "./interviewResearch";

import {
  KitSchema,
  type Kit,
} from "../schemas/kit.schema";

interface RunPipelineInput {
  jd: string;
  company_url: string;
  days: number;
  allowPrivateUrls?: boolean;
}

function inferCompanyName(
  companyUrl: string,
  homepageTitle: string
): string {
  // Example:
  // "Trao - AI Systems for Enterprise Automation"
  // -> "Trao"
  if (homepageTitle.trim()) {
    const firstPart = homepageTitle
      .split("|")[0]
      .split(" - ")[0]
      .trim();

    if (firstPart) {
      return firstPart;
    }
  }

  try {
    const url = new URL(companyUrl);

    // Useful for evaluator URLs such as:
    // http://localhost:8099/acme/
    const pathPart = url.pathname
      .split("/")
      .filter(Boolean)[0];

    if (pathPart) {
      return pathPart;
    }

    return url.hostname
      .replace(/^www\./, "")
      .split(".")[0];
  } catch {
    return "";
  }
}

export async function runPipeline({
  jd,
  company_url,
  days,
  allowPrivateUrls = false,
}: RunPipelineInput): Promise<Kit> {
  if (!jd.trim()) {
    throw new Error("Job description is required");
  }

  if (!company_url.trim()) {
    throw new Error("Company URL is required");
  }

  if (!Number.isInteger(days) || days < 1 || days > 60) {
    throw new Error(
      "Days must be an integer between 1 and 60"
    );
  }

  console.log("Pipeline: extracting requirements");

  const role = await extractRequirements(jd);

  console.log("Pipeline: crawling company");

  const crawl = await crawlCompany(company_url, {
    allowPrivateUrls,
  });

  const companyName = inferCompanyName(
    company_url,
    crawl.homepage.title
  );

  console.log("Pipeline: generating company brief");

  const companyBrief =
    await generateCompanyBrief(crawl);

  console.log(
    "Pipeline: researching public interview process"
  );

  const interviewResearch =
    await researchInterviewProcess(
      companyName,
      company_url,
      role.title
    );

  console.log(
    `Pipeline: interview research found=${interviewResearch.found} sources=${interviewResearch.sources.length}`
  );

  console.log("Pipeline: generating questions");

  const initialQuestions =
    await generateAllQuestions(
      role.requirements,
      companyBrief,
      interviewResearch
    );

  console.log("Pipeline: checking coverage");

  const coverageResult =
    await ensureCoverage(
      role.requirements,
      initialQuestions,
      companyBrief
    );

  console.log("Pipeline: generating flashcards");

  const flashcards =
    await generateFlashcards(
      role.requirements
    );

  console.log("Pipeline: building schedule");

  const schedule = buildSchedule(
    role.requirements,
    coverageResult.questions,
    days
  );

  const pagesUsed = Array.from(
    new Set([
      company_url,
      crawl.homepage.url,
      ...crawl.pages.map((page) => page.url),
      ...interviewResearch.sources.map(
        (source) => source.url
      ),
    ])
  );

  const kit: Kit = {
    source: {
      company: companyName,
      company_url,
      role: role.title,
      location: "",
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: pagesUsed,
    },

    company_brief: companyBrief,

    role: {
      title: role.title,
      seniority: role.seniority,
      responsibilities: role.responsibilities,
      requirements: role.requirements,
    },

    questions: coverageResult.questions,

    flashcards,

    schedule,

    coverage: {
      uncovered_requirement_ids:
        coverageResult.uncovered_requirement_ids,

      passes: coverageResult.passes,
    },
  };

  // Final safety gate.
  // Nothing leaves this pipeline unless it matches
  // Trao's required structure.
  return KitSchema.parse(kit);
}
