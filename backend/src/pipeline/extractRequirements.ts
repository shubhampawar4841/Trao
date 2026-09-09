import { z } from "zod";
import { groq, GROQ_MODEL } from "../utils/groq";
import { withRetry } from "../utils/retry";
import type { Requirement } from "../schemas/kit.schema";

const RequirementKindSchema = z.enum([
  "technical",
  "behavioural",
  "domain",
]);

const RequirementPrioritySchema = z.enum([
  "must",
  "nice",
]);

const ExtractionSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(
    z.object({
      text: z.string(),
      kind: RequirementKindSchema,
      priority: RequirementPrioritySchema,
    })
  ),
});

export interface ExtractedRole {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

const MAX_STRUCTURED_OUTPUT_ATTEMPTS = 2;

/** Soft cap for extreme JDs; normal postings stay intact. */
const MAX_JD_CHARS = 20000;

/** Keep extraction JSON small enough for free-tier completion limits. */
const MAX_REQUIREMENTS = 12;

function normalizeKind(
  value: unknown
): "technical" | "behavioural" | "domain" {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    raw === "behavioural" ||
    raw === "behavioral" ||
    raw.includes("behav") ||
    raw.includes("soft") ||
    raw.includes("leadership") ||
    raw.includes("communication") ||
    raw.includes("culture")
  ) {
    return "behavioural";
  }

  if (
    raw === "domain" ||
    raw.includes("business") ||
    raw.includes("industry") ||
    raw.includes("product")
  ) {
    return "domain";
  }

  // Default unknown / technical aliases here.
  return "technical";
}

function normalizePriority(
  value: unknown
): "must" | "nice" {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    raw === "nice" ||
    raw.includes("prefer") ||
    raw.includes("optional") ||
    raw.includes("bonus") ||
    raw.includes("good-to-have") ||
    raw.includes("good to have")
  ) {
    return "nice";
  }

  return "must";
}

function normalizeExtractionPayload(
  value: unknown
): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  const payload = value as Record<string, unknown>;

  if (!Array.isArray(payload.requirements)) {
    return payload;
  }

  return {
    ...payload,
    requirements: payload.requirements
      .filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object"
      )
      .map((item) => ({
        ...item,
        text:
          typeof item.text === "string"
            ? item.text.trim()
            : item.text,
        kind: normalizeKind(item.kind),
        priority: normalizePriority(item.priority),
      }))
      .filter(
        (item) =>
          typeof item.text === "string" &&
          item.text.length > 0
      )
      .slice(0, MAX_REQUIREMENTS),
  };
}

export async function extractRequirements(
  jd: string
): Promise<ExtractedRole> {
  const jdForModel =
    jd.length > MAX_JD_CHARS
      ? jd.slice(0, MAX_JD_CHARS)
      : jd;

  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= MAX_STRUCTURED_OUTPUT_ATTEMPTS;
    attempt++
  ) {
    try {
      const completion = await withRetry(() =>
        groq.chat.completions.create({
          model: GROQ_MODEL,

          messages: [
            {
              role: "system",
              content: `
You extract structured information from job descriptions.

IMPORTANT RULES:
- Use ONLY information explicitly present in the job description.
- Do NOT invent skills, experience, responsibilities, seniority, or requirements.
- If the job description is very short, return fewer requirements.
- Return at most ${MAX_REQUIREMENTS} requirements. Prefer must-haves.
- "must" means clearly required, expected, mandatory, or core to the role.
- "nice" means preferred, bonus, optional, good-to-have, or similar.
- Do not turn generic company marketing text into job requirements.
- Preserve the meaning of each requirement.
- Keep requirements atomic: one requirement per item.

Requirement kinds — use EXACTLY one of these spellings:
- "technical": languages, frameworks, databases, architecture, engineering skills
- "behavioural": communication, mentoring, ownership, collaboration, leadership
- "domain": industry/business/domain knowledge

Never use "behavioral", "soft-skill", "other", or any other kind value.
priority must be exactly "must" or "nice".

Return JSON only in this exact shape:

{
  "title": "",
  "seniority": "",
  "responsibilities": [],
  "requirements": [
    {
      "text": "",
      "kind": "technical",
      "priority": "must"
    }
  ]
}
              `.trim(),
            },

            {
              role: "user",
              content: `
JOB DESCRIPTION:

${jdForModel}
              `.trim(),
            },
          ],

          temperature: 0.1,
          max_completion_tokens: 2500,

          response_format: {
            type: "json_object",
          },
        })
      );

      const content =
        completion.choices[0]?.message?.content;

      if (!content) {
        throw new Error(
          "Groq returned an empty requirement extraction"
        );
      }

      let parsedJson: unknown;

      try {
        parsedJson = JSON.parse(content);
      } catch {
        throw new Error(
          "Groq returned invalid JSON"
        );
      }

      const parsed = ExtractionSchema.parse(
        normalizeExtractionPayload(parsedJson)
      );

      const requirements: Requirement[] =
        parsed.requirements.map(
          (requirement, index) => ({
            id: `r${index + 1}`,
            text: requirement.text,
            kind: requirement.kind,
            priority: requirement.priority,
          })
        );

      return {
        title: parsed.title,
        seniority: parsed.seniority,
        responsibilities: parsed.responsibilities,
        requirements,
      };
    } catch (error) {
      lastError = error;

      const malformedOutput =
        error instanceof z.ZodError ||
        (error instanceof Error &&
          [
            "Groq returned invalid JSON",
            "Groq returned an empty requirement extraction",
          ].includes(error.message));

      // Provider/network errors are already
      // handled by withRetry().
      // Only retry malformed structured output here.
      if (
        !malformedOutput ||
        attempt === MAX_STRUCTURED_OUTPUT_ATTEMPTS
      ) {
        throw error;
      }

      console.warn(
        `Invalid structured requirement output. Retrying (${attempt}/${MAX_STRUCTURED_OUTPUT_ATTEMPTS})`
      );
    }
  }

  throw lastError;
}
