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