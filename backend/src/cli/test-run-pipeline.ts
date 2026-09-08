import { runPipeline } from "../pipeline/runPipeline";

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
  console.log("Running full pipeline...\n");

  const kit = await runPipeline({
    jd,
    company_url: "https://www.trao.ai",
    days: 5,
  });

  console.log("\n=== FINAL KIT ===\n");

  console.dir(kit, {
    depth: null,
  });

  console.log("\n=== VALIDATION SUMMARY ===");

  console.log("Company:", kit.source.company);
  console.log("Role:", kit.role.title);
  console.log(
    "Requirements:",
    kit.role.requirements.length
  );
  console.log(
    "Questions:",
    kit.questions.length
  );
  console.log(
    "Flashcards:",
    kit.flashcards.length
  );
  console.log(
    "Schedule days:",
    kit.schedule.days.length
  );
  console.log(
    "Coverage passes:",
    kit.coverage.passes
  );
  console.log(
    "Uncovered:",
    kit.coverage.uncovered_requirement_ids
  );

  console.log(
    "\n✅ Final kit passed KitSchema validation"
  );
}

main().catch((error) => {
  console.error("\n❌ Pipeline failed");
  console.error(error);
  process.exit(1);
});