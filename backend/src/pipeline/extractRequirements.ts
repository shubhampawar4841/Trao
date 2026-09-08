import { z } from "zod";
import { groq, GROQ_MODEL } from "../utils/groq";
import { withRetry } from "../utils/retry";
import type { Requirement } from "../schemas/kit.schema";

const ExtractionSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(
    z.object({
      text: z.string(),
      kind: z.enum(["technical", "behavioural", "domain"]),
      priority: z.enum(["must", "nice"]),
    })
  ),
});

export interface ExtractedRole {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

export async function extractRequirements(
  jd: string
): Promise<ExtractedRole> {
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
- "must" means clearly required, expected, mandatory, or core to the role.
- "nice" means preferred, bonus, optional, good-to-have, or similar.
- Do not turn generic company marketing text into job requirements.
- Preserve the meaning of each requirement.
- Keep requirements atomic: one requirement per item.

Requirement kinds:
- technical: languages, frameworks, databases, architecture, engineering skills
- behavioural: communication, mentoring, ownership, collaboration, leadership
- domain: industry/business/domain knowledge

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

${jd}
        `.trim(),
        },
      ],

      temperature: 0.1,
      response_format: {
        type: "json_object",
      },
    })
  );

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty requirement extraction");
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error("Groq returned invalid JSON");
  }

  const parsed = ExtractionSchema.parse(parsedJson);

  const requirements: Requirement[] = parsed.requirements.map(
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
}