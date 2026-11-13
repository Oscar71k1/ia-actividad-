import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCase, summarize } from '../src/comparison.mjs';

const testCase = {
  id: 'C01',
  expected: { category: 'ACCESS', priority: 'MEDIUM', requiresHumanReview: false },
};

test('un acierto exige coincidir en categoría y prioridad', () => {
  const result = { category: 'ACCESS', priority: 'MEDIUM', response: 'ok', requiresHumanReview: false, mode: 'traditional' };
  const evaluation = evaluateCase(testCase, result, { mode: 'traditional' });
  assert.equal(evaluation.correct, true);
  assert.equal(evaluation.formatValid, true);
  assert.equal(evaluation.reviewMatchesExpected, true);

  assert.equal(evaluateCase(testCase, { ...result, priority: 'HIGH' }, { mode: 'traditional' }).correct, false);
  assert.equal(evaluateCase(testCase, { ...result, category: 'BUG' }, { mode: 'traditional' }).correct, false);
  assert.equal(evaluateCase(testCase, { ...result, mode: 'generative' }, { mode: 'traditional' }).formatValid, false);
});

test('un resultado nulo o incompleto no acierta ni cumple formato', () => {
  const evaluation = evaluateCase(testCase, null);
  assert.equal(evaluation.correct, false);
  assert.equal(evaluation.formatValid, false);
  assert.equal(evaluation.reviewMatchesExpected, false);
  assert.equal(evaluation.category, null);
});

test('resume aciertos, formato y revisión humana', () => {
  const rows = [
    { correct: true, formatValid: true, reviewMatchesExpected: true },
    { correct: false, formatValid: true, reviewMatchesExpected: true },
    { correct: true, formatValid: false, reviewMatchesExpected: false },
    { correct: false, formatValid: false, reviewMatchesExpected: false },
  ];
  assert.deepEqual(summarize(rows), {
    total: 4,
    correct: 2,
    percent: 50,
    formatValid: 2,
    formatPercent: 50,
    reviewMatchesExpected: 2,
    reviewPercent: 50,
  });
});

test('un conjunto vacío no divide por cero', () => {
  assert.deepEqual(summarize([]), {
    total: 0,
    correct: 0,
    percent: 0,
    formatValid: 0,
    formatPercent: 0,
    reviewMatchesExpected: 0,
    reviewPercent: 0,
  });
});
