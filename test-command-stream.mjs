#!/usr/bin/env node

console.log('Testing command-stream...');

// Dynamically load use-m
const { use } = eval(
  await fetch('https://unpkg.com/use-m/use.js').then(u => u.text())
);

console.log('Loaded use-m');

// Load command-stream
console.log('Loading command-stream@0.3.0...');
const commandStreamModule = await use('command-stream@0.3.0');
console.log('Command-stream module loaded:', typeof commandStreamModule);
console.log('Command-stream keys:', Object.keys(commandStreamModule));

const { $ } = commandStreamModule;
console.log('$ function type:', typeof $);

// Test basic usage
console.log('Testing basic $ usage...');
try {
  const result = await $`echo "Hello World"`;
  console.log('✓ Basic test result:', result);
  console.log('✓ stdout:', result.stdout);
  console.log('✓ stderr:', result.stderr);
} catch (err) {
  console.log('✗ Basic test error:', err.message);
}

// Test with environment variables - different syntax
console.log('Testing $ with environment variables...');
try {
  // Try direct env setting
  process.env.TEST_VAR = 'test-value';
  const result = await $`echo $TEST_VAR`;
  console.log('✓ Environment test result:', result.stdout.trim());
  delete process.env.TEST_VAR;
} catch (err) {
  console.log('✗ Environment test error:', err.message);
}

// Test with exec function for env vars
console.log('Testing exec function for env vars...');
try {
  const { exec } = commandStreamModule;
  if (exec) {
    const result = await exec('echo $TEST_VAR', { env: { TEST_VAR: 'test-value', ...process.env } });
    console.log('✓ Exec test result:', result);
  } else {
    console.log('Exec function not available');
  }
} catch (err) {
  console.log('✗ Exec test error:', err.message);
}

// Test with run function
console.log('Testing run function...');
try {
  const { run } = commandStreamModule;
  if (run) {
    const result = await run('echo test-run');
    console.log('✓ Run test result:', result);
  } else {
    console.log('Run function not available');
  }
} catch (err) {
  console.log('✗ Run test error:', err.message);
}

// Test error handling
console.log('Testing $ error handling...');
try {
  await $`exit 1`;
  console.log('✗ Should have thrown an error');
} catch (err) {
  console.log('✓ Error handling works:', err.message);
}

// Test expected unsupported syntax
console.log('Testing expected unsupported syntax...');
try {
  // This syntax should NOT work with command-stream 0.3.0
  const result = await $({ env: { TEST_VAR: 'test-value' } })`echo $TEST_VAR`;
  console.log('✗ Unexpected: unsupported syntax worked:', result.stdout);
} catch (err) {
  console.log('✓ Expected: unsupported syntax failed as expected:', err.message);
}

console.log('Command-stream test completed');