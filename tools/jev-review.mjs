import { execSync } from "node:child_process";

const apiKey = process.env.EXPERIENTIAL_API_KEY;

if (!apiKey) {
  throw new Error(
    "EXPERIENTIAL_API_KEY is not set. Set it in your terminal before running the review."
  );
}

function run(command) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    return `Command failed: ${command}\n${error.stderr || error.message}`;
  }
}

// Collect the current Git state.
const diff = run("git diff");
const status = run("git status --short");

// Collect recent test evidence if available.
// We will improve this later to accept your actual test command.
const testSummary =
  "No automated test script is currently configured in package.json. " +
  "The project has dev and deploy scripts only. " +
    "Therefore automated test evidence is unavailable.";
  
    
const payload = {
  model: "jev-latest",

  state: {
    task: "Review the current development changes before they are committed or merged.",

    diff_summary: diff || "No unstaged Git diff was found.",

    implementation_summary:
      "Review the changes shown in the Git diff and determine whether they appear to satisfy the intended development task.",

    test_summary: testSummary,

    git_status: status || "Working tree is clean.",

    known_risks:
      "Missing tests, incomplete evidence, unintended changes, regressions, and changes that may violate existing project behavior."
  },

  questions: {
    review: {
      type: "choice",

      instructions:
        "Does the supplied evidence support accepting these changes, or do they require further human review? Treat missing or insufficient evidence as a reason to review.",

      criteria: {
        accept:
          "The implementation appears to satisfy the intended task, the supplied evidence is adequate, and there is no significant unresolved risk.",

        review:
          "Evidence is missing or insufficient, the implementation may be incorrect, relevant tests are inadequate, unintended changes are present, or a significant unresolved risk exists."
      }
    },

    test_coverage: {
      type: "score",

      instructions:
        "Score how adequately the supplied testing evidence covers the behavior affected by the changes.",

      criteria: [
        "Very poor: Relevant behavior is largely untested.",
        "Poor: Only a small portion of relevant behavior is tested.",
        "Adequate: Main behavior is tested but important cases remain uncovered.",
        "Good: Main behavior and important edge cases are tested.",
        "Excellent: Relevant behavior, edge cases, regression risks, and failure paths are well covered."
      ]
    },

    regression_risk: {
      type: "score",

      instructions:
        "Score the likelihood that these changes introduce a regression based only on the supplied evidence.",

      criteria: [
        "Very low: Strong evidence indicates minimal regression risk.",
        "Low: Limited regression risk is evident.",
        "Moderate: Some meaningful regression risk remains.",
        "High: Significant regression risk is evident or important evidence is missing.",
        "Very high: The changes have substantial unresolved regression risk."
      ]
    }
  }
};

const response = await fetch(
  "https://api.experientiallabs.ai/v1/systemone",
  {
    method: "POST",

    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },

    body: JSON.stringify(payload),

    signal: AbortSignal.timeout(60000),

    redirect: "error"
  }
);

if (!response.ok) {
  const body = await response.text();

  throw new Error(
    `JEV request failed (${response.status}): ${body}`
  );
}

const result = await response.json();

console.log("\n==============================");
console.log("       JEV CODE REVIEW");
console.log("==============================\n");

console.log(
  JSON.stringify(result, null, 2)
);

console.log("\n==============================");
console.log("        END JEV REVIEW");
console.log("==============================\n");