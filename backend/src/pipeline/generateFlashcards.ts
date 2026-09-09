import { z } from "zod";
import { groq, GROQ_MODEL } from "../utils/groq";
import { withRetry } from "../utils/retry";
import { isStructuredOutputTruncation } from "../utils/structuredOutput";
import type {
  Flashcard,
  Requirement,
} from "../schemas/kit.schema";

const FlashcardsSchema = z.object({
  flashcards: z.array(
    z.object({
      front: z.string(),
      back: z.string(),
      requirement_ids: z.array(z.string()),
    })
  ),
});

const MAX_FLASHCARDS = 10;
const MAX_COMPLETION_TOKENS = 3000;

async function requestFlashcards(
  requirements: Requirement[],
  maxFlashcards: number
): Promise<Flashcard[]> {
  const requirementBlock = requirements
    .map(
      (r) =>
        `${r.id} | ${r.priority} | ${r.kind} | ${r.text}`
    )
    .join("\n");

  const completion = await withRetry(() =>
    groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.2,
      max_completion_tokens: MAX_COMPLETION_TOKENS,

      response_format: {
        type: "json_object",
      },

      messages: [
        {
          role: "system",
          content: `
You create concise interview-preparation flashcards.

RULES:
- Use ONLY the supplied requirements.
- Do not invent skills or requirements.
- Every flashcard must reference at least one valid requirement id.
- Never create requirement ids yourself.
- Prefer must-have requirements.
- Keep the front concise and question-like.
- Keep the back useful but brief (1-3 short sentences).
- Generate at most ${maxFlashcards} flashcards total.
- Prefer one strong card per important requirement over many weak cards.

Flashcards should help the candidate prepare for the interview.

Prefer cards that:
- explain or apply an actual requirement
- review an important technical/domain concept
- prepare a useful behavioural example

Avoid low-value cards that only ask the candidate to repeat metadata from the job description, such as:
- exact years of experience required
- degree requirements
- job location
- whether a skill is required

Every flashcard must stay grounded in the extracted requirement_ids.
Do not invent requirements or candidate experience.

Return JSON only.

Expected shape:

{
  "flashcards": [
    {
      "front": "",
      "back": "",
      "requirement_ids": ["r1"]
    }
  ]
}
          `.trim(),
        },
        {
          role: "user",
          content: `
REQUIREMENTS:

${requirementBlock}

Return at most ${maxFlashcards} flashcards.
          `.trim(),
        },
      ],
    })
  );

  const content =
    completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error(
      "Groq returned no flashcards"
    );
  }

  let json: unknown;

  try {
    json = JSON.parse(content);
  } catch {
    throw new Error(
      "Groq returned invalid JSON for flashcards"
    );
  }

  const parsed =
    FlashcardsSchema.parse(json);

  const validRequirementIds = new Set(
    requirements.map((r) => r.id)
  );

  return parsed.flashcards
    .filter(
      (flashcard) =>
        flashcard.requirement_ids.length > 0 &&
        flashcard.requirement_ids.every((id) =>
          validRequirementIds.has(id)
        )
    )
    .slice(0, maxFlashcards)
    .map((flashcard, index) => ({
      id: `f${index + 1}`,
      front: flashcard.front,
      back: flashcard.back,
      requirement_ids:
        flashcard.requirement_ids,
    }));
}

export async function generateFlashcards(
  requirements: Requirement[]
): Promise<Flashcard[]> {
  if (requirements.length === 0) {
    return [];
  }

  const limits = [
    MAX_FLASHCARDS,
    Math.max(5, Math.floor(MAX_FLASHCARDS / 2)),
  ];

  let lastError: unknown;

  for (let i = 0; i < limits.length; i++) {
    const maxFlashcards = limits[i];

    try {
      return await requestFlashcards(
        requirements,
        maxFlashcards
      );
    } catch (error) {
      lastError = error;

      const canShrink =
        i < limits.length - 1 &&
        isStructuredOutputTruncation(error);

      if (!canShrink) {
        throw error;
      }

      console.warn(
        `Truncated flashcard JSON. Retrying with max ${limits[i + 1]} flashcards.`
      );
    }
  }

  throw lastError;
}
