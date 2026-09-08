import type {
  Question,
  Requirement,
} from "../schemas/kit.schema";

import { findUncoveredRequirements } from "./coverage";
import { generateQuestionsForCategory } from "./generateQuestions";
import type { CompanyBrief } from "./generateCompanyBrief";

interface CoverageResult {
  questions: Question[];
  uncovered_requirement_ids: string[];
  passes: number;
}

export async function ensureCoverage(
  requirements: Requirement[],
  questions: Question[],
  companyBrief: CompanyBrief
): Promise<CoverageResult> {
  let currentQuestions = [...questions];

  let uncovered =
    findUncoveredRequirements(
      requirements,
      currentQuestions
    );

  let passes = 1;

  const MAX_PASSES = 2;

  while (
    uncovered.length > 0 &&
    passes < MAX_PASSES
  ) {
    console.log(
      `Coverage gaps: ${uncovered.join(", ")}`
    );

    const missingRequirements =
      requirements.filter((requirement) =>
        uncovered.includes(requirement.id)
      );

    for (const requirement of missingRequirements) {
      const category =
        requirement.kind === "behavioural"
          ? "behavioural"
          : "technical";

      const generated =
        await generateQuestionsForCategory({
          requirements: [requirement],
          companyBrief,
          category,
        });

      currentQuestions.push(...generated);
    }

    currentQuestions =
      currentQuestions.map(
        (question, index) => ({
          ...question,
          id: `q${index + 1}`,
        })
      );

    passes++;

    uncovered =
      findUncoveredRequirements(
        requirements,
        currentQuestions
      );
  }

  return {
    questions: currentQuestions,
    uncovered_requirement_ids: uncovered,
    passes,
  };
}
