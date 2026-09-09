import { z } from "zod";
import { groq, GROQ_MODEL } from "../utils/groq";
import { withRetry } from "../utils/retry";
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

export async function generateFlashcards(
  requirements: Requirement[]
): Promise<Flashcard[]> {
  if (requirements.length === 0) {
    return [];
  }

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
- Keep the back useful but brief.
- Create roughly 1-2 flashcards per important requirement.

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
    .map((flashcard, index) => ({
      id: `f${index + 1}`,
      front: flashcard.front,
      back: flashcard.back,
      requirement_ids:
        flashcard.requirement_ids,
    }));
}