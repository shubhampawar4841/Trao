import type {
    Question,
    Requirement,
  } from "../schemas/kit.schema";
  
  export function buildSchedule(
    requirements: Requirement[],
    questions: Question[],
    daysAvailable: number
  ) {
    const days = Math.max(1, Math.min(daysAvailable, 60));
  
    const requirementMap = new Map(
      requirements.map((requirement) => [
        requirement.id,
        requirement,
      ])
    );
  
    const sortedQuestions = [...questions].sort((a, b) => {
      const aMust = a.requirement_ids.some(
        (id) => requirementMap.get(id)?.priority === "must"
      );
  
      const bMust = b.requirement_ids.some(
        (id) => requirementMap.get(id)?.priority === "must"
      );
  
      if (aMust !== bMust) {
        return aMust ? -1 : 1;
      }
  
      return b.difficulty - a.difficulty;
    });
  
    const schedule = Array.from({ length: days }, (_, index) => ({
      day: index + 1,
      focus: "",
      question_ids: [] as string[],
      minutes: 0,
    }));
  
    sortedQuestions.forEach((question, index) => {
      const dayIndex = index % days;
  
      schedule[dayIndex].question_ids.push(question.id);
  
      schedule[dayIndex].minutes +=
        question.difficulty === 3
          ? 20
          : question.difficulty === 2
          ? 15
          : 10;
    });
  
    schedule.forEach((day) => {
      day.focus =
        day.question_ids.length > 0
          ? "Interview preparation"
          : "Review and reinforcement";
    });
  
    return {
      days_available: days,
      days: schedule,
    };
  }