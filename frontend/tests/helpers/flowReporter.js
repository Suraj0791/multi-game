let stepNumber = 0;
let testLabel = '';

export function startFlow(label) {
  stepNumber = 0;
  testLabel = label;
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  FLOW: ${label}`);
  console.log(`═══════════════════════════════════════════\n`);
}

export function flowStep(description, payload = '') {
  stepNumber++;
  const payloadStr = payload ? ` ${typeof payload === 'object' ? JSON.stringify(payload) : payload}` : '';
  console.log(`  [STEP ${stepNumber}] ${description}${payloadStr}`);
}

export function flowStepOk(description, payload = '') {
  stepNumber++;
  const payloadStr = payload ? ` ${typeof payload === 'object' ? JSON.stringify(payload) : payload}` : '';
  console.log(`  [STEP ${stepNumber}] ${description}${payloadStr} ✓`);
}

export function flowStepFail(description, error, payload = '') {
  stepNumber++;
  const payloadStr = payload ? ` ${typeof payload === 'object' ? JSON.stringify(payload) : payload}` : '';
  console.error(`  [STEP ${stepNumber}] ${description}${payloadStr} ❌`);
  if (error) {
    console.error(`  ERROR: ${error.message || error}`);
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 6).join('\n          ');
      console.error(`  STACK: ${stackLines}`);
    }
  }
}

export async function flowStepAsync(description, asyncFn, payload = '') {
  stepNumber++;
  const payloadStr = payload ? ` ${typeof payload === 'object' ? JSON.stringify(payload) : payload}` : '';
  console.log(`  [STEP ${stepNumber}] ${description}${payloadStr} ...`);
  try {
    const result = await asyncFn();
    const resultStr = result ? ` → ${typeof result === 'object' ? JSON.stringify(result).slice(0, 100) : result}` : '';
    console.log(`  [STEP ${stepNumber}] ${description}${payloadStr} ✓${resultStr}`);
    return result;
  } catch (error) {
    console.error(`  [STEP ${stepNumber}] ${description}${payloadStr} ❌`);
    console.error(`  ERROR: ${error.message || error}`);
    throw error;
  }
}

export function endFlow(success = true, extraInfo = '') {
  const status = success ? '✅ PASSED' : '❌ FAILED';
  const extra = extraInfo ? ` — ${extraInfo}` : '';
  console.log(`\n  FLOW RESULT: ${status}${extra}`);
  console.log(`  Total Steps: ${stepNumber}`);
  console.log(`───────────────────────────────────────────\n`);
}
