import { researchInterviewProcess } from "../pipeline/interviewResearch";

async function main() {
  const cases = [
    {
      companyName: "Trao",
      companyUrl: "https://www.trao.ai",
      roleTitle: "Software Engineer",
    },
    {
      companyName: "Amazon",
      companyUrl: "https://www.amazon.com",
      roleTitle: "Software Development Engineer",
    },
  ];

  for (const testCase of cases) {
    console.log(
      `\n========== ${testCase.companyName} ==========`
    );

    const result = await researchInterviewProcess(
      testCase.companyName,
      testCase.companyUrl,
      testCase.roleTitle
    );

    console.dir(
      {
        found: result.found,
        note: result.note,
        queries: result.queries,
        sourceCount: result.sources.length,
        sources: result.sources.map((source) => ({
          url: source.url,
          score: source.score,
          evidence: source.evidence.slice(0, 2),
        })),
      },
      { depth: null }
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
