import { CATEGORIES, MODES, PRIORITIES } from './contract.mjs';

/**
 * Compara un resultado con la clasificación de referencia de un caso.
 * El acierto se calcula con categoría y prioridad, según la consigna.
 * El formato y la revisión humana se registran por separado.
 */
export function evaluateCase(testCase, result, { mode } = {}) {
  const expected = testCase.expected;
  const formatValid =
    Boolean(result) &&
    CATEGORIES.includes(result.category) &&
    PRIORITIES.includes(result.priority) &&
    typeof result.response === 'string' &&
    result.response.trim().length > 0 &&
    typeof result.requiresHumanReview === 'boolean' &&
    (mode ? result.mode === mode : MODES.includes(result.mode));

  return {
    expected,
    category: result?.category ?? null,
    priority: result?.priority ?? null,
    requiresHumanReview: result?.requiresHumanReview ?? null,
    formatValid,
    correct: Boolean(result) && result.category === expected.category && result.priority === expected.priority,
    reviewMatchesExpected: Boolean(result) && result.requiresHumanReview === expected.requiresHumanReview,
  };
}

/** Resume aciertos, formato y revisión humana para un conjunto de resultados. */
export function summarize(results) {
  const total = results.length;
  const percent = (count) => (total ? Number(((count / total) * 100).toFixed(1)) : 0);
  return {
    total,
    correct: results.filter((item) => item.correct).length,
    percent: percent(results.filter((item) => item.correct).length),
    formatValid: results.filter((item) => item.formatValid).length,
    formatPercent: percent(results.filter((item) => item.formatValid).length),
    reviewMatchesExpected: results.filter((item) => item.reviewMatchesExpected).length,
    reviewPercent: percent(results.filter((item) => item.reviewMatchesExpected).length),
  };
}
