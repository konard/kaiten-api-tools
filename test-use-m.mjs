#!/usr/bin/env node
/**
 * test-use-m.mjs
 * Tests for use-m functionality and compatibility issues.
 * Usage: node test-use-m.mjs
 */

// Dynamically load use-m
const { use } = eval(
  await fetch('https://unpkg.com/use-m/use.js').then(u => u.text())
);

// Import test runner and assertions
const { test } = await use('uvu@0.5.6');
const { is, ok } = await use('uvu@0.5.6/assert');

test('use-m can load external npm packages', async () => {
  const debugModule = await use('debug@4.3.4');
  // debug can be either function (main export) or object with exports
  ok(typeof debugModule === 'function' || typeof debugModule === 'object');
  
  const axiosModule = await use('axios@1.9.0');
  // axios can be either function (main export) or object
  ok(typeof axiosModule === 'function' || typeof axiosModule === 'object');
  
  const yargsModule = await use('yargs@17.7.2');
  // yargs can be either function or object
  ok(typeof yargsModule === 'function' || typeof yargsModule === 'object');
});

test('use-m can load Node.js built-in modules', async () => {
  const pathModule = await use('node:path');
  is(typeof pathModule, 'object');
  is(pathModule.join('a', 'b'), 'a/b');
  
  const urlModule = await use('node:url');
  is(typeof urlModule, 'object');
  
  const fsModule = await use('node:fs');
  is(typeof fsModule, 'object');
  is(typeof fsModule.readFileSync, 'function');
});

test('use-m node:fs/promises bug: returns callback-based functions', async () => {
  const fsPromises = await use('node:fs/promises');
  is(typeof fsPromises, 'object');
  ok(Object.keys(fsPromises).length > 0);
  
  const { mkdir } = fsPromises;
  is(typeof mkdir, 'function');
  
  // This demonstrates the bug: use-m returns callback-based mkdir (3 params) 
  // instead of promise-based mkdir (2 params)
  is(mkdir.length, 3, 'use-m bug: mkdir has 3 params (callback version)');
});

test('native import vs use-m comparison shows the difference', async () => {
  const nativeFsPromises = await import('node:fs/promises');
  const { mkdir: nativeMkdir } = nativeFsPromises;
  is(nativeMkdir.length, 2, 'native mkdir has 2 params (promise version)');
  
  const useMFsPromises = await use('node:fs/promises');
  const { mkdir: useMkdir } = useMFsPromises;
  is(useMkdir.length, 3, 'use-m mkdir has 3 params (callback version)');
  
  // This test documents the mismatch
  ok(nativeMkdir.length !== useMkdir.length, 'Native and use-m return different mkdir functions');
});

test('use-m can load local modules', async () => {
  const createSpace = await use('./create-space.mjs');
  is(typeof createSpace, 'object');
  is(typeof createSpace.createSpace, 'function');
});

test.run();