import fs from "node:fs/promises";
import path from "node:path";
import { runPipeline } from "../pipeline/runPipeline";
import type { Kit } from "../schemas/kit.schema";

interface EvaluationCase {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

interface EvaluationSuccess {
  id: string;
  status: "ok";
  kit: Kit;
  error: null;
}

interface EvaluationFailure {
  id: string;
  status: "failed";
  kit: null;
  error: {
    code: string;
    message: string;
  };
}

type EvaluationResult =
  | EvaluationSuccess
  | EvaluationFailure;

function getArgument(name: string): string {
  const index = process.argv.indexOf(name);

  if (index === -1 || !process.argv[index + 1]) {
    throw new Error(`Missing required argument: ${name}`);
  }

  return process.argv[index + 1];
}

function getErrorCode(error: unknown): string {
  if (!(error instanceof Error)) {
    return "PIPELINE_FAILED";
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("invalid company url") ||
    message.includes("could not resolve") ||
    message.includes("enotfound") ||
    message.includes("econnrefused") ||
    message.includes("timeout") ||
    message.includes("404") ||
    message.includes("unreachable")
  ) {
    return "COMPANY_UNREACHABLE";
  }

  if (message.includes("rate limit")) {
    return "RATE_LIMITED";
  }

  if (message.includes("job description")) {
    return "INVALID_JOB_DESCRIPTION";
  }

  if (
    message.includes("validation") ||
    message.includes("zod") ||
    message.includes("invalid_type") ||
    message.includes("expected number")
  ) {
    return "KIT_VALIDATION_FAILED";
  }

  return "PIPELINE_FAILED";
}

async function runCase(
  testCase: EvaluationCase
): Promise<EvaluationResult> {
  try {
    console.log(`\nRunning ${testCase.id}...`);

    const { kit } = await runPipeline({
      jd: testCase.jd,
      company_url: testCase.company_url,
      days: testCase.days,
      allowPrivateUrls: true,
    });

    console.log(`✓ ${testCase.id}`);

    return {
      id: testCase.id,
      status: "ok",
      kit,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown pipeline failure";

    console.error(`✗ ${testCase.id}: ${message}`);

    return {
      id: testCase.id,
      status: "failed",
      kit: null,
      error: {
        code: getErrorCode(error),
        message,
      },
    };
  }
}

async function main() {
  const inputArg = getArgument("--input");
  const outputArg = getArgument("--output");

  // npm --prefix changes cwd to backend/; INIT_CWD is the directory
  // where the user invoked `npm run evaluate` (usually repo root).
  const baseDir = process.env.INIT_CWD || process.cwd();
  const inputPath = path.resolve(baseDir, inputArg);
  const outputPath = path.resolve(baseDir, outputArg);

  const raw = await fs.readFile(
    inputPath,
    "utf8"
  );

  let cases: EvaluationCase[];

  try {
    cases = JSON.parse(raw);
  } catch {
    throw new Error(
      "Input file contains invalid JSON"
    );
  }

  if (!Array.isArray(cases)) {
    throw new Error(
      "Input must be an array of evaluation cases"
    );
  }

  const results: EvaluationResult[] = [];

  // Intentionally continue after individual failures.
  for (const testCase of cases) {
    const result = await runCase(testCase);

    results.push(result);
  }

  const output = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits: results,
  };

  await fs.writeFile(
    outputPath,
    JSON.stringify(output, null, 2),
    "utf8"
  );

  console.log(
    `\nEvaluation complete: ${outputPath}`
  );

  console.log(
    `Success: ${
      results.filter((r) => r.status === "ok").length
    }`
  );

  console.log(
    `Failed: ${
      results.filter((r) => r.status === "failed").length
    }`
  );
}

main().catch((error) => {
  console.error("\nEvaluation runner failed:");
  console.error(error);
  process.exit(1);
});