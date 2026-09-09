import { researchInterviewProcess } from "../pipeline/interviewResearch";

async function main() {
  const cases = [
    {
      companyName: "Google",
      companyUrl: "https://www.google.com",
      roleTitle: "Software Engineer",
    },
    {
      companyName: "Amazon",
      companyUrl: "https://www.amazon.com",
      roleTitle: "Software Development Engineer",
    },
    {
      companyName: "Microsoft",
      companyUrl: "https://www.microsoft.com",
      roleTitle: "Software Engineer",
    },
    {
      companyName: "Flipkart",
      companyUrl: "https://www.flipkart.com",
      roleTitle: "Software Engineer",
    },
  ];

  for (const testCase of cases) {
    console.log(
      `\n\n========== ${testCase.companyName} ==========`
    );

    const result =
      await researchInterviewProcess(
        testCase.companyName,
        testCase.companyUrl,
        testCase.roleTitle
      );

    console.dir(
      {
        found: result.found,
        note: result.note,
        sources: result.sources,
      },
      {
        depth: null,
      }
    );
  }
}

main().catch(console.error);
