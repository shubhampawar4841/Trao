import { crawlCompany } from "../pipeline/crawlCompany";

async function main() {
  const url = process.argv[2] || "https://www.amazon.jobs";

  console.log(`Crawling ${url}...`);

  const result = await crawlCompany(url);

  console.log("\n=== HOMEPAGE ===");
  console.log(result.homepage.title);
  console.log(result.homepage.url);

  console.log("\n=== FETCHED PAGES ===");
  for (const page of result.pages) {
    console.log(
      `${page.score} | ${page.title} | ${page.url}`
    );
  }

  console.log("\n=== SKIPPED ===");
  console.dir(result.skipped, { depth: null });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
