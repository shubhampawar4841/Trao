import { z } from "zod";

export const RequirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum([
    "technical",
    "behavioural",
    "domain",
  ]),
  priority: z.enum([
    "must",
    "nice",
  ]),
});

export const QuestionSchema = z.object({
  id: z.string(),

  requirement_ids: z.array(
    z.string()
  ),

  category: z.enum([
    "technical",
    "behavioural",
    "system-design",
    "company-fit",
  ]),

  prompt: z.string(),

  answer_outline: z.string(),

  difficulty: z
    .number()
    .int()
    .min(1)
    .max(3),
});

export const FlashcardSchema = z.object({
  id: z.string(),

  front: z.string(),

  back: z.string(),

  requirement_ids: z.array(
    z.string()
  ),
});

export const ScheduleDaySchema = z.object({
  day: z
    .number()
    .int()
    .positive(),

  focus: z.string(),

  question_ids: z.array(
    z.string()
  ),

  minutes: z
    .number()
    .int()
    .nonnegative(),
});

export const KitSchema = z.object({
  source: z.object({
    company: z.string(),

    company_url: z.string(),

    role: z.string(),

    location: z.string(),

    jd_chars: z
      .number()
      .int()
      .nonnegative(),

    researched_at: z.string(),

    pages_used: z.array(
      z.string()
    ),
  }),

  company_brief: z.object({
    summary: z.string(),

    what_they_do: z.string(),

    sources: z.array(
      z.string()
    ),
  }),

  role: z.object({
    title: z.string(),

    seniority: z.string(),

    responsibilities: z.array(
      z.string()
    ),

    requirements: z.array(
      RequirementSchema
    ),
  }),

  questions: z.array(
    QuestionSchema
  ),

  flashcards: z.array(
    FlashcardSchema
  ),

  schedule: z.object({
    days_available: z
      .number()
      .int()
      .positive(),

    days: z.array(
      ScheduleDaySchema
    ),
  }),

  coverage: z.object({
    uncovered_requirement_ids:
      z.array(z.string()),

    passes: z
      .number()
      .int()
      .nonnegative(),
  }),
}).superRefine((kit, ctx) => {
  const requirementIds = new Set(
    kit.role.requirements.map((r) => r.id)
  );

  const questionIds = new Set(
    kit.questions.map((q) => q.id)
  );

  const flashcardIds = new Set(
    kit.flashcards.map((f) => f.id)
  );

  // Duplicate requirement IDs
  if (
    requirementIds.size !==
    kit.role.requirements.length
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Requirement IDs must be unique",
      path: ["role", "requirements"],
    });
  }

  // Duplicate question IDs
  if (
    questionIds.size !==
    kit.questions.length
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Question IDs must be unique",
      path: ["questions"],
    });
  }

  // Duplicate flashcard IDs
  if (
    flashcardIds.size !==
    kit.flashcards.length
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Flashcard IDs must be unique",
      path: ["flashcards"],
    });
  }

  // Questions must reference real requirements
  kit.questions.forEach((question, index) => {
    for (const requirementId of question.requirement_ids) {
      if (!requirementIds.has(requirementId)) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown requirement ID: ${requirementId}`,
          path: [
            "questions",
            index,
            "requirement_ids",
          ],
        });
      }
    }
  });

  // Flashcards must reference real requirements
  kit.flashcards.forEach((flashcard, index) => {
    for (const requirementId of flashcard.requirement_ids) {
      if (!requirementIds.has(requirementId)) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown requirement ID: ${requirementId}`,
          path: [
            "flashcards",
            index,
            "requirement_ids",
          ],
        });
      }
    }
  });

  // Exactly N schedule days
  if (
    kit.schedule.days.length !==
    kit.schedule.days_available
  ) {
    ctx.addIssue({
      code: "custom",
      message:
        "Schedule must contain exactly days_available days",
      path: ["schedule", "days"],
    });
  }

  // Schedule question IDs must exist
  const scheduledQuestionIds = new Set<string>();

  kit.schedule.days.forEach((day, dayIndex) => {
    for (const questionId of day.question_ids) {
      if (!questionIds.has(questionId)) {
        ctx.addIssue({
          code: "custom",
          message: `Unknown scheduled question ID: ${questionId}`,
          path: [
            "schedule",
            "days",
            dayIndex,
            "question_ids",
          ],
        });
      }

      scheduledQuestionIds.add(questionId);
    }
  });

  // Determine which requirements appear in scheduled questions
  const scheduledRequirementIds = new Set<string>();

  for (const question of kit.questions) {
    if (!scheduledQuestionIds.has(question.id)) {
      continue;
    }

    for (const requirementId of question.requirement_ids) {
      scheduledRequirementIds.add(requirementId);
    }
  }

  // Every must-have must appear in schedule
  const missingMustRequirements =
    kit.role.requirements
      .filter(
        (requirement) =>
          requirement.priority === "must" &&
          !scheduledRequirementIds.has(
            requirement.id
          )
      )
      .map((requirement) => requirement.id);

  if (missingMustRequirements.length > 0) {
    ctx.addIssue({
      code: "custom",
      message: `Must-have requirements missing from schedule: ${missingMustRequirements.join(
        ", "
      )}`,
      path: ["schedule"],
    });
  }

  // Never ship a kit with uncovered must-have requirements
  if (
    kit.coverage.uncovered_requirement_ids.length >
    0
  ) {
    ctx.addIssue({
      code: "custom",
      message: `Kit still has uncovered requirements: ${kit.coverage.uncovered_requirement_ids.join(
        ", "
      )}`,
      path: [
        "coverage",
        "uncovered_requirement_ids",
      ],
    });
  }
});

export type Requirement =
  z.infer<typeof RequirementSchema>;

export type Question =
  z.infer<typeof QuestionSchema>;

export type Flashcard =
  z.infer<typeof FlashcardSchema>;

export type ScheduleDay =
  z.infer<typeof ScheduleDaySchema>;

export type Kit =
  z.infer<typeof KitSchema>;
