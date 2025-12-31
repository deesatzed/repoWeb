import assert from 'node:assert/strict';
import test from 'node:test';

import { redactForLLM } from '../lib/redaction';

test('redactForLLM strips fenced code blocks', () => {
  const input = 'hello\n```ts\nconst x = 1\n```\nworld';
  const out = redactForLLM(input);
  assert.ok(out.includes('[REDACTED_CODE_BLOCK]'));
  assert.ok(!out.includes('const x = 1'));
});

test('redactForLLM strips inline code', () => {
  const input = 'use `rm -rf /` carefully';
  const out = redactForLLM(input);
  assert.ok(out.includes('[REDACTED_INLINE_CODE]'));
  assert.ok(!out.includes('rm -rf /'));
});

test('redactForLLM redacts common secrets', () => {
  const input = 'token=ghp_abcdefghijklmnopqrstuvwxyzABCDE12345 and key=AKIA1234567890ABCDEF';
  const out = redactForLLM(input);
  assert.ok(!out.includes('ghp_'));
  assert.ok(!out.includes('AKIA'));
  assert.equal(out.includes('[REDACTED_SECRET]'), true);
});

test('redactForLLM enforces maxLength', () => {
  const input = 'a'.repeat(5000);
  const out = redactForLLM(input, { maxLength: 100 });
  assert.equal(out.length, 100);
});
