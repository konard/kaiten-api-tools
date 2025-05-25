#!/usr/bin/env node
/**
 * test-axios-error-serialization.mjs
 * Checks if AxiosError has a toJSON function for error serialization.
 * This test intentionally makes a failing GET request to a non-existent URL.
 */

// Dynamically load use-m
const { use } = eval(
  await fetch('https://unpkg.com/use-m/use.js').then(u => u.text())
);

const axiosModule = await use('axios@1.9.0');
const axios = axiosModule.default || axiosModule;

(async () => {
  try {
    // Intentionally fail: connect to a non-existent port
    await axios.get('http://localhost:9999/this-should-fail');
  } catch (err) {
    console.log('Is AxiosError:', err.isAxiosError === true);
    console.log('Has toJSON:', typeof err.toJSON === 'function');
    if (typeof err.toJSON === 'function') {
      console.log('Serialized error:', JSON.stringify(err.toJSON(), null, 2));
    } else {
      console.log('Error does not have toJSON.');
    }
    process.exit(0);
  }
  // If no error thrown, test failed
  console.error('Test failed: request did not throw.');
  process.exit(1);
})();
