#!/usr/bin/env node
/**
 * test-axios-error-serialization.mjs
 * Tests AxiosError serialization capabilities.
 * Checks if AxiosError has a toJSON function for error serialization.
 * This test intentionally makes a failing GET request to a non-existent URL.
 * Usage: node test-axios-error-serialization.mjs
 */

// Dynamically load use-m
const { use } = eval(
  await fetch('https://unpkg.com/use-m/use.js').then(u => u.text())
);

// Import test runner and assertions
const { test } = await use('uvu@0.5.6');
const { is, ok } = await use('uvu@0.5.6/assert');

const axiosModule = await use('axios@1.9.0');
const axios = axiosModule.default || axiosModule;

// Test AxiosError properties
test('AxiosError: should have isAxiosError property', async () => {
  try {
    // Intentionally fail: connect to a non-existent port
    await axios.get('http://localhost:9999/this-should-fail');
    ok(false, 'Request should have failed');
  } catch (err) {
    is(err.isAxiosError, true);
  }
});

// Test AxiosError serialization
test('AxiosError: should have toJSON method for serialization', async () => {
  try {
    // Intentionally fail: connect to a non-existent port
    await axios.get('http://localhost:9999/this-should-fail');
    ok(false, 'Request should have failed');
  } catch (err) {
    ok(typeof err.toJSON === 'function', 'AxiosError should have toJSON method');
    
    // Test the serialization
    const serialized = err.toJSON();
    ok(typeof serialized === 'object', 'toJSON should return an object');
    ok('message' in serialized, 'Serialized error should have message property');
    ok('code' in serialized, 'Serialized error should have code property');
    ok('name' in serialized, 'Serialized error should have name property');
    ok('stack' in serialized, 'Serialized error should have stack property');
    ok('config' in serialized, 'Serialized error should have config property');
    
    // Check specific properties
    is(typeof serialized.message, 'string', 'message should be a string');
    is(typeof serialized.code, 'string', 'code should be a string');
    is(typeof serialized.name, 'string', 'name should be a string');
    is(typeof serialized.stack, 'string', 'stack should be a string');
    ok(typeof serialized.config === 'object', 'config should be an object');
    
    // Check config properties
    ok('url' in serialized.config, 'config should have url property');
    ok('method' in serialized.config, 'config should have method property');
    ok('headers' in serialized.config, 'config should have headers property');
    
    // Check specific values
    is(serialized.config.method, 'get', 'method should be "get"');
    is(serialized.config.url, 'http://localhost:9999/this-should-fail', 'url should match');
    is(serialized.code, 'ECONNREFUSED', 'code should be ECONNREFUSED');
    is(serialized.name, 'Error', 'name should be Error');
  }
});

// Test AxiosError instance properties
test('AxiosError: should have expected instance properties', async () => {
  try {
    // Intentionally fail: connect to a non-existent port
    await axios.get('http://localhost:9999/this-should-fail');
    ok(false, 'Request should have failed');
  } catch (err) {
    // Check instance properties
    ok(err instanceof Error, 'AxiosError should be instance of Error');
    ok('config' in err, 'AxiosError should have config property');
    ok('code' in err, 'AxiosError should have code property');
    ok('request' in err, 'AxiosError should have request property');
    // response property may not be present for connection errors
    
    // Check specific values
    is(err.code, 'ECONNREFUSED', 'error code should be ECONNREFUSED');
    is(err.config.url, 'http://localhost:9999/this-should-fail', 'config url should match');
    is(err.config.method, 'get', 'config method should be get');
    is(err.response, undefined, 'response should be undefined for connection refused');
  }
});

test.run();
