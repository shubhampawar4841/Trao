import { firecrawl } from "../utils/firecrawl";

async function main() {
  console.log("Searching with Firecrawl...\n");

  const result = await firecrawl.search(
    "Trao AI interview process software engineer",
    {
      limit: 5,
    }
  );

  console.dir(result.web, {
    depth: null,
  });
}

main().catch((error) => {
  console.error("Firecrawl test failed:");
  console.error(error);
  process.exit(1);
});