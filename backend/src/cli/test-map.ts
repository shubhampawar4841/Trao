import { firecrawl } from "../utils/firecrawl";

async function main() {
  const companies = [
    {
      name: "Trao",
      url: "https://www.trao.ai",
    },
    {
      name: "Amazon",
      url: "https://www.amazon.jobs",
    },
    {
      name: "Microsoft",
      url: "https://www.microsoft.com",
    },
  ];

  for (const company of companies) {
    console.log(
      `\n========== ${company.name} ==========`
    );

    const started = Date.now();

    const result = await firecrawl.map(
      company.url,
      {
        search:
          "careers jobs hiring engineering about team culture",
        limit: 5,
        includeSubdomains: false,
      }
    );

    console.log(
      `Time: ${Date.now() - started}ms`
    );

    console.dir(result, {
      depth: null,
    });
  }
}

main().catch(console.error);
