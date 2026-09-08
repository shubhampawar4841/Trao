import { researchInterviewProcess } from "../pipeline/interviewResearch";

async function main() {
  console.log("Researching Trao interviews...\n");

  const result = await researchInterviewProcess("Trao");

  console.dir(result, {
    depth: null,
  });
}

main().catch(console.error);