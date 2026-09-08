import { crawlCompany } from "../pipeline/crawlCompany";

async function main() {
  const result = await crawlCompany(
    "https://www.trao.ai"
  );

  console.log("\n=== HOMEPAGE ===");
  console.log(result.homepage.title);
  console.log(result.homepage.url);

  console.log("\n=== FETCHED PAGES ===");

  result.pages.forEach((page) => {
    console.log(
      `\n${page.score} | ${page.title}\n${page.url}`
    );

    console.log(page.text.slice(0, 300));
  });

  console.log("\n=== SKIPPED ===");
  console.dir(result.skipped, {
    depth: null,
  });
}

main().catch((error) => {
  console.error("Crawler failed:");
  console.error(error);
  process.exit(1);
});