import type {
    Question,
    Requirement,
  } from "../schemas/kit.schema";
  
  export function findUncoveredRequirements(
    requirements: Requirement[],
    questions: Question[]
  ): string[] {
    const mustHaveRequirements = requirements.filter(
      (requirement) => requirement.priority === "must"
    );
  
    return mustHaveRequirements
      .filter((requirement) => {
        const isCovered = questions.some((question) =>
          question.requirement_ids.includes(requirement.id)
        );
  
        return !isCovered;
      })
      .map((requirement) => requirement.id);
  }