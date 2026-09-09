import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}));

vi.mock("../utils/groq", () => ({
  GROQ_MODEL: "test-model",

  groq: {
    chat: {
      completions: {
        create: createMock,
      },
    },
  },
}));

import { extractRequirements } from "./extractRequirements";

describe(
  "extractRequirements structured output handling",
  () => {
    beforeEach(() => {
      createMock.mockReset();
    });

    it(
      "retries when model returns malformed JSON",
      async () => {
        createMock
          .mockResolvedValueOnce({
            choices: [
              {
                message: {
                  content: "this is not json",
                },
              },
            ],
          })
          .mockResolvedValueOnce({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "Software Engineer",
                    seniority: "",
                    responsibilities: [],
                    requirements: [
                      {
                        text: "Experience with Python",
                        kind: "technical",
                        priority: "must",
                      },
                    ],
                  }),
                },
              },
            ],
          });

        const result = await extractRequirements(
          "Experience with Python required."
        );

        expect(createMock).toHaveBeenCalledTimes(2);

        expect(result.requirements).toEqual([
          {
            id: "r1",
            text: "Experience with Python",
            kind: "technical",
            priority: "must",
          },
        ]);
      }
    );

    it(
      "normalizes American spelling and unknown kinds",
      async () => {
        createMock.mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "Software Engineer",
                  seniority: "",
                  responsibilities: [],
                  requirements: [
                    {
                      text: "Strong communication",
                      kind: "behavioral",
                      priority: "required",
                    },
                    {
                      text: "Python experience",
                      kind: "coding",
                      priority: "preferred",
                    },
                    {
                      text: "Fintech domain knowledge",
                      kind: "industry",
                      priority: "must",
                    },
                  ],
                }),
              },
            },
          ],
        });

        const result = await extractRequirements(
          "Strong communication. Python. Fintech."
        );

        expect(createMock).toHaveBeenCalledTimes(1);
        expect(result.requirements).toEqual([
          {
            id: "r1",
            text: "Strong communication",
            kind: "behavioural",
            priority: "must",
          },
          {
            id: "r2",
            text: "Python experience",
            kind: "technical",
            priority: "nice",
          },
          {
            id: "r3",
            text: "Fintech domain knowledge",
            kind: "domain",
            priority: "must",
          },
        ]);
      }
    );

    it(
      "rejects incomplete structured output after retry",
      async () => {
        const incomplete = JSON.stringify({
          title: "Software Engineer",
          // seniority missing
          responsibilities: [],
          requirements: [],
        });

        createMock
          .mockResolvedValueOnce({
            choices: [
              {
                message: {
                  content: incomplete,
                },
              },
            ],
          })
          .mockResolvedValueOnce({
            choices: [
              {
                message: {
                  content: incomplete,
                },
              },
            ],
          });

        await expect(
          extractRequirements("Software Engineer")
        ).rejects.toThrow();

        expect(createMock).toHaveBeenCalledTimes(2);
      }
    );
  }
);
