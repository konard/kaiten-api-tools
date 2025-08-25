#!/usr/bin/env node

console.log('=== Testing use-m functionality ===');

// Dynamically load use-m
const { use } = eval(
  await fetch('https://unpkg.com/use-m/use.js').then(u => u.text())
);

console.log('✓ Loaded use-m');

// Test 1: Load external npm packages
console.log('\n1. Testing external npm packages...');
try {
  const debugModule = await use('debug@4.3.4');
  console.log('✓ debug module loaded:', typeof debugModule);
  
  const axiosModule = await use('axios@1.9.0');
  console.log('✓ axios module loaded:', typeof axiosModule);
  
  const yargsModule = await use('yargs@17.7.2');
  console.log('✓ yargs module loaded:', typeof yargsModule);
} catch (err) {
  console.log('✗ External packages error:', err.message);
}

// Test 2: Load Node.js built-in modules
console.log('\n2. Testing Node.js built-in modules...');
try {
  const pathModule = await use('node:path');
  console.log('✓ node:path loaded:', typeof pathModule);
  console.log('✓ path.join works:', pathModule.join('a', 'b'));
  
  const urlModule = await use('node:url');
  console.log('✓ node:url loaded:', typeof urlModule);
  
  const fsModule = await use('node:fs');
  console.log('✓ node:fs loaded:', typeof fsModule);
  console.log('✓ fs.readFileSync exists:', typeof fsModule.readFileSync);
} catch (err) {
  console.log('✗ Built-in modules error:', err.message);
}

// Test 3: Test the problematic node:fs/promises
console.log('\n3. Testing problematic node:fs/promises...');
try {
  const fsPromises = await use('node:fs/promises');
  console.log('✓ node:fs/promises loaded:', typeof fsPromises);
  console.log('✓ Keys available:', Object.keys(fsPromises).slice(0, 10));
  
  const { mkdir } = fsPromises;
  console.log('✓ mkdir type:', typeof mkdir);
  console.log('✓ mkdir params count:', mkdir.length);
  
  if (mkdir.length === 3) {
    console.log('⚠️  WARNING: mkdir has 3 params (callback version) - this is the bug!');
    console.log('⚠️  Expected: 2 params (promise version)');
  } else if (mkdir.length === 2) {
    console.log('✓ mkdir has 2 params (promise version) - working correctly!');
  }
  
} catch (err) {
  console.log('✗ node:fs/promises error:', err.message);
}

// Test 4: Compare with native import
console.log('\n4. Comparing with native import...');
try {
  const nativeFsPromises = await import('node:fs/promises');
  const { mkdir: nativeMkdir } = nativeFsPromises;
  console.log('✓ Native mkdir params count:', nativeMkdir.length);
  console.log('✓ Native mkdir toString:', nativeMkdir.toString().substring(0, 50) + '...');
  
  const useMFsPromises = await use('node:fs/promises');
  const { mkdir: useMkdir } = useMFsPromises;
  console.log('✓ use-m mkdir params count:', useMkdir.length);
  console.log('✓ use-m mkdir toString:', useMkdir.toString().substring(0, 50) + '...');
  
  if (nativeMkdir.length !== useMkdir.length) {
    console.log('✗ MISMATCH: Native and use-m return different mkdir functions!');
  } else {
    console.log('✓ MATCH: Native and use-m return same mkdir function');
  }
  
} catch (err) {
  console.log('✗ Comparison error:', err.message);
}

// Test 5: Local module loading
console.log('\n5. Testing local module loading...');
try {
  const createSpace = await use('./create-space.mjs');
  console.log('✓ Local module loaded:', typeof createSpace);
  if (createSpace.createSpace) {
    console.log('✓ createSpace function available:', typeof createSpace.createSpace);
  }
} catch (err) {
  console.log('✗ Local module error:', err.message);
}

console.log('\n=== use-m test completed ===');