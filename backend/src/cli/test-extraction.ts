import { extractRequirements } from "../pipeline/extractRequirements";

const jd = `
Software Engineer

We are looking for an engineer with strong React and Node.js experience.

Requirements:
- Strong experience with React
- Experience building REST APIs with Node.js and Express
- Good communication and collaboration skills

Nice to have:
- Docker experience

You will build production features and work closely with product and engineering teams.
`;

async function main() {
  console.log("Extracting requirements...\n");

  const result = await extractRequirements(jd);

  console.dir(result, {
    depth: null,
  });
}

main().catch((error) => {
  console.error("Extraction failed:");
  console.error(error);
  process.exit(1);
});