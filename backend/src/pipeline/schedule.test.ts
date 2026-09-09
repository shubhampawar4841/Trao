import { describe, expect, it } from "vitest";

import { buildSchedule } from "./schedule";

import type {
  Question,
  Requirement,
} from "../schemas/kit.schema";

const requirements: Requirement[] = [
  {
    id: "r1",
    text: "React",
    kind: "technical",
    priority: "must",
  },
  {
    id: "r2",
    text: "Node.js",
    kind: "technical",
    priority: "must",
  },
  {
    id: "r3",
    text: "Docker",
    kind: "technical",
    priority: "nice",
  },
];

const questions: Question[] = [
  {
    id: "q1",
    requirement_ids: ["r1"],
    category: "technical",
    prompt: "React question",
    answer_outline: "React answer",
    difficulty: 3,
  },
  {
    id: "q2",
    requirement_ids: ["r2"],
    category: "technical",
    prompt: "Node question",
    answer_outline: "Node answer",
    difficulty: 2,
  },
  {
    id: "q3",
    requirement_ids: ["r3"],
    category: "technical",
    prompt: "Docker question",
    answer_outline: "Docker answer",
    difficulty: 3,
  },
];

describe("buildSchedule", () => {
  it("creates exactly the requested number of days", () => {
    const schedule = buildSchedule(
      requirements,
      questions,
      5
    );

    expect(schedule.days_available).toBe(5);
    expect(schedule.days).toHaveLength(5);
  });

  it("clamps days to minimum of 1", () => {
    const schedule = buildSchedule(
      requirements,
      questions,
      0
    );

    expect(schedule.days_available).toBe(1);
    expect(schedule.days).toHaveLength(1);
  });

  it("clamps days to maximum of 60", () => {
    const schedule = buildSchedule(
      requirements,
      questions,
      100
    );

    expect(schedule.days_available).toBe(60);
    expect(schedule.days).toHaveLength(60);
  });

  it("creates sequential day numbers", () => {
    const schedule = buildSchedule(
      requirements,
      questions,
      3
    );

    expect(
      schedule.days.map((day) => day.day)
    ).toEqual([1, 2, 3]);
  });

  it("schedules every question exactly once", () => {
    const schedule = buildSchedule(
      requirements,
      questions,
      2
    );

    const scheduledQuestionIds =
      schedule.days.flatMap(
        (day) => day.question_ids
      );

    expect(
      scheduledQuestionIds.sort()
    ).toEqual(
      questions.map((q) => q.id).sort()
    );

    expect(
      new Set(scheduledQuestionIds).size
    ).toBe(questions.length);
  });

  it("prioritizes must-have questions before nice-to-have questions", () => {
    const schedule = buildSchedule(
      requirements,
      questions,
      3
    );

    // q1 and q2 are must-have.
    // q3 is nice-to-have, even though difficulty is 3.
    expect(
      schedule.days[0].question_ids[0]
    ).toBe("q1");

    expect(
      schedule.days[1].question_ids[0]
    ).toBe("q2");

    expect(
      schedule.days[2].question_ids[0]
    ).toBe("q3");
  });

  it("prioritizes harder questions within the same priority", () => {
    const samePriorityQuestions: Question[] = [
      {
        id: "q-easy",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Easy",
        answer_outline: "Answer",
        difficulty: 1,
      },
      {
        id: "q-hard",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Hard",
        answer_outline: "Answer",
        difficulty: 3,
      },
    ];

    const schedule = buildSchedule(
      requirements,
      samePriorityQuestions,
      2
    );

    expect(
      schedule.days[0].question_ids[0]
    ).toBe("q-hard");

    expect(
      schedule.days[1].question_ids[0]
    ).toBe("q-easy");
  });

  it("calculates minutes from difficulty", () => {
    const schedule = buildSchedule(
      requirements,
      questions,
      3
    );

    expect(schedule.days[0].minutes).toBe(
      20
    );

    expect(schedule.days[1].minutes).toBe(
      15
    );

    expect(schedule.days[2].minutes).toBe(
      20
    );
  });

  it("uses review focus for empty days", () => {
    const schedule = buildSchedule(
      requirements,
      questions.slice(0, 1),
      3
    );

    expect(schedule.days[0].focus).toBe(
      "Interview preparation"
    );

    expect(schedule.days[1].focus).toBe(
      "Review and reinforcement"
    );
  });
});
