import { describe, expect, it } from "vitest";

import { findUncoveredRequirements } from "./coverage";

import type {
  Question,
  Requirement,
} from "../schemas/kit.schema";

describe("findUncoveredRequirements", () => {
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

  it("returns no uncovered requirements when all must-haves are covered", () => {
    const questions: Question[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "React?",
        answer_outline: "Answer",
        difficulty: 2,
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "technical",
        prompt: "Node?",
        answer_outline: "Answer",
        difficulty: 2,
      },
    ];

    expect(
      findUncoveredRequirements(
        requirements,
        questions
      )
    ).toEqual([]);
  });

  it("detects an uncovered must-have requirement", () => {
    const questions: Question[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "React?",
        answer_outline: "Answer",
        difficulty: 2,
      },
    ];

    expect(
      findUncoveredRequirements(
        requirements,
        questions
      )
    ).toEqual(["r2"]);
  });

  it("does not require nice-to-have requirements to be covered", () => {
    const questions: Question[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "React?",
        answer_outline: "Answer",
        difficulty: 2,
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "technical",
        prompt: "Node?",
        answer_outline: "Answer",
        difficulty: 2,
      },
    ];

    expect(
      findUncoveredRequirements(
        requirements,
        questions
      )
    ).not.toContain("r3");
  });

  it("returns all must-have requirements when there are no questions", () => {
    expect(
      findUncoveredRequirements(
        requirements,
        []
      )
    ).toEqual(["r1", "r2"]);
  });

  it("allows one question to cover multiple requirements", () => {
    const questions: Question[] = [
      {
        id: "q1",
        requirement_ids: ["r1", "r2"],
        category: "system-design",
        prompt: "Full stack question",
        answer_outline: "Answer",
        difficulty: 3,
      },
    ];

    expect(
      findUncoveredRequirements(
        requirements,
        questions
      )
    ).toEqual([]);
  });
});
