import { crawlCompany } from "../pipeline/crawlCompany";
import { generateCompanyBrief } from "../pipeline/generateCompanyBrief";

async function main() {
  console.log("Crawling company...\n");

  const crawl = await crawlCompany(
    "https://www.trao.ai"
  );

  console.log("\nGenerating company brief...\n");

  const brief = await generateCompanyBrief(crawl);

  console.dir(brief, {
    depth: null,
  });
}

main().catch((error) => {
  console.error("Company brief test failed:");
  console.error(error);
  process.exit(1);
});