import { extractRequirements } from "../pipeline/extractRequirements";
import { crawlCompany } from "../pipeline/crawlCompany";
import { generateCompanyBrief } from "../pipeline/generateCompanyBrief";
import { generateAllQuestions } from "../pipeline/generateQuestions";
import { findUncoveredRequirements } from "../pipeline/coverage";
import { buildSchedule } from "../pipeline/schedule";

const jd = `
Software Engineer

We are looking for someone with strong React and Node.js experience.

Requirements:
- Strong React experience
- Experience building APIs with Node.js and Express
- Good communication and collaboration skills

Nice to have:
- Docker experience
`;

async function main() {
  console.log("1. Extracting requirements...\n");

  const role = await extractRequirements(jd);

  console.dir(role, {
    depth: null,
  });

  console.log("\n2. Crawling company...\n");

  const crawl = await crawlCompany(
    "https://www.trao.ai"
  );

  console.log(
    `Found ${crawl.pages.length + 1} company pages`
  );

  console.log("\n3. Generating company brief...\n");

  const companyBrief =
    await generateCompanyBrief(crawl);

  console.dir(companyBrief, {
    depth: null,
  });

  console.log("\n4. Generating questions...\n");

  const questions = await generateAllQuestions(
    role.requirements,
    companyBrief
  );

  console.dir(questions, {
    depth: null,
  });

  console.log("\n5. Checking coverage...\n");

  const uncovered =
    findUncoveredRequirements(
      role.requirements,
      questions
    );

  console.log(
    "Uncovered requirement IDs:",
    uncovered
  );

  console.log("\n6. Building schedule...\n");

  const schedule = buildSchedule(
    role.requirements,
    questions,
    5
  );

  console.dir(schedule, {
    depth: null,
  });
}

main().catch((error) => {
  console.error("\nPipeline failed:");
  console.error(error);
  process.exit(1);
});