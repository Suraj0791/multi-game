let stepNumber = 0;
let testLabel = '';

export function startTest(label) {
  stepNumber = 0;
  testLabel = label;
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  TEST: ${label}`);
  console.log(`═══════════════════════════════════════════\n`);
}

export function step(description, payload = '') {
  stepNumber++;
  const prefix = `[STEP ${stepNumber}]`;
  const payloadStr = payload ? ` ${JSON.stringify(payload)}` : '';
  console.log(`  ${prefix} ${description}${payloadStr}`);
}

export function stepOk(description, payload = '') {
  stepNumber++;
  const prefix = `[STEP ${stepNumber}]`;
  const payloadStr = payload ? ` ${JSON.stringify(payload)}` : '';
  console.log(`  ${prefix} ${description}${payloadStr} ✓`);
}

export function stepFail(description, error, payload = '') {
  stepNumber++;
  const prefix = `[STEP ${stepNumber}]`;
  const payloadStr = payload ? ` ${JSON.stringify(payload)}` : '';
  console.error(`  ${prefix} ${description}${payloadStr} ❌`);
  if (error) {
    console.error(`  ERROR: ${error.message || error}`);
    if (error.stack) console.error(`  STACK: ${error.stack.split('\n').slice(0, 4).join('\n          ')}`);
  }
}

export function endTest(success = true) {
  const status = success ? '✅ PASSED' : '❌ FAILED';
  console.log(`\n  TEST RESULT: ${status}`);
  console.log(`  Total Steps: ${stepNumber}`);
  console.log(`───────────────────────────────────────────\n`);
}
