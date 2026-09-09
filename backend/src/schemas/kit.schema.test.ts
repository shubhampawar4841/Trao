import { describe, expect, it } from "vitest";

import { KitSchema } from "./kit.schema";

function createValidKit() {
  return {
    source: {
      company: "Example",
      company_url: "https://example.com",
      role: "Software Engineer",
      location: "",
      jd_chars: 100,
      researched_at:
        "2026-09-09T00:00:00.000Z",
      pages_used: [
        "https://example.com",
      ],
    },

    company_brief: {
      summary: "Example company",
      what_they_do: "Builds software",
      sources: [
        "https://example.com",
      ],
    },

    role: {
      title: "Software Engineer",
      seniority: "",
      responsibilities: [
        "Build software",
      ],
      requirements: [
        {
          id: "r1",
          text: "React",
          kind: "technical" as const,
          priority: "must" as const,
        },
        {
          id: "r2",
          text: "Docker",
          kind: "technical" as const,
          priority: "nice" as const,
        },
      ],
    },

    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical" as const,
        prompt: "Explain React",
        answer_outline: "React answer",
        difficulty: 2,
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "technical" as const,
        prompt: "Explain Docker",
        answer_outline: "Docker answer",
        difficulty: 1,
      },
    ],

    flashcards: [
      {
        id: "f1",
        front: "React?",
        back: "Frontend library",
        requirement_ids: ["r1"],
      },
    ],

    schedule: {
      days_available: 2,
      days: [
        {
          day: 1,
          focus: "React",
          question_ids: ["q1"],
          minutes: 15,
        },
        {
          day: 2,
          focus: "Docker",
          question_ids: ["q2"],
          minutes: 10,
        },
      ],
    },

    coverage: {
      uncovered_requirement_ids: [] as string[],
      passes: 1,
    },
  };
}

describe("KitSchema", () => {
  it("accepts a valid kit", () => {
    const result =
      KitSchema.safeParse(
        createValidKit()
      );

    expect(result.success).toBe(true);
  });

  it("rejects duplicate requirement IDs", () => {
    const kit = createValidKit();

    kit.role.requirements.push({
      id: "r1",
      text: "Duplicate",
      kind: "technical",
      priority: "must",
    });

    const result =
      KitSchema.safeParse(kit);

    expect(result.success).toBe(false);
  });

  it("rejects duplicate question IDs", () => {
    const kit = createValidKit();

    kit.questions.push({
      ...kit.questions[0],
    });

    const result =
      KitSchema.safeParse(kit);

    expect(result.success).toBe(false);
  });

  it("rejects duplicate flashcard IDs", () => {
    const kit = createValidKit();

    kit.flashcards.push({
      ...kit.flashcards[0],
    });

    const result =
      KitSchema.safeParse(kit);

    expect(result.success).toBe(false);
  });

  it("rejects questions referencing an unknown requirement", () => {
    const kit = createValidKit();

    kit.questions[0].requirement_ids = [
      "r999",
    ];

    const result =
      KitSchema.safeParse(kit);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.message.includes(
              "Unknown requirement ID"
            )
        )
      ).toBe(true);
    }
  });

  it("rejects flashcards referencing an unknown requirement", () => {
    const kit = createValidKit();

    kit.flashcards[0].requirement_ids = [
      "r999",
    ];

    const result =
      KitSchema.safeParse(kit);

    expect(result.success).toBe(false);
  });

  it("rejects schedule question IDs that do not exist", () => {
    const kit = createValidKit();

    kit.schedule.days[0].question_ids = [
      "q999",
    ];

    const result =
      KitSchema.safeParse(kit);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.message.includes(
              "Unknown scheduled question ID"
            )
        )
      ).toBe(true);
    }
  });

  it("requires exactly days_available schedule days", () => {
    const kit = createValidKit();

    kit.schedule.days_available = 3;

    const result =
      KitSchema.safeParse(kit);

    expect(result.success).toBe(false);
  });

  it("rejects a kit when a must-have requirement is absent from the schedule", () => {
    const kit = createValidKit();

    // q1 covers must-have r1.
    // Remove q1 from schedule.
    kit.schedule.days[0].question_ids = [];

    const result =
      KitSchema.safeParse(kit);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.message.includes(
              "Must-have requirements missing"
            )
        )
      ).toBe(true);
    }
  });

  it("rejects a kit with uncovered requirements", () => {
    const kit = createValidKit();

    kit.coverage
      .uncovered_requirement_ids = [
      "r1",
    ];

    const result =
      KitSchema.safeParse(kit);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.message.includes(
              "Kit still has uncovered requirements"
            )
        )
      ).toBe(true);
    }
  });

  it("allows an uncovered nice-to-have to be absent from the schedule", () => {
    const kit = createValidKit();

    // Remove Docker question from schedule.
    kit.schedule.days[1].question_ids = [];

    const result =
      KitSchema.safeParse(kit);

    expect(result.success).toBe(true);
  });

  it("rejects difficulty outside the allowed 1-3 range", () => {
    const kit = createValidKit();

    kit.questions[0].difficulty = 4;

    const result =
      KitSchema.safeParse(kit);

    expect(result.success).toBe(false);
  });
});
