import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeMl,
  evaluateModel,
  formatClassificationReport,
  loadTickets,
  parseCsv,
  TfidfVectorizer,
  trainModel,
  trainTestSplit,
} from '../src/ml.mjs';

const tickets = loadTickets();
const model = trainModel(tickets);

test('parseCsv respeta la cabecera, las comillas y las comas internas', () => {
  const rows = parseCsv('message,category\n"Hola, mundo","BUG"\n"Dijo ""hola""",ACCESS\n');
  assert.deepEqual(rows, [
    { message: 'Hola, mundo', category: 'BUG' },
    { message: 'Dijo "hola"', category: 'ACCESS' },
  ]);
});

test('loadTickets carga el reemplazo de tickets.csv con las cuatro categorías', () => {
  assert.ok(tickets.length >= 40);
  assert.deepEqual([...new Set(tickets.map((ticket) => ticket.category))].sort(),
    ['ACCESS', 'BUG', 'FEATURE', 'SECURITY']);
});

test('trainTestSplit es estratificado, determinista y sin filas repetidas', () => {
  const first = trainTestSplit(tickets);
  const second = trainTestSplit(tickets);
  assert.deepEqual(first, second);

  const categories = [...new Set(tickets.map((ticket) => ticket.category))];
  for (const category of categories) {
    const total = tickets.filter((ticket) => ticket.category === category).length;
    const trainCount = first.train.filter((ticket) => ticket.category === category).length;
    const testCount = first.test.filter((ticket) => ticket.category === category).length;
    assert.ok(testCount >= 1 && trainCount >= 1);
    assert.equal(trainCount + testCount, total);
  }

  const messages = (rows) => rows.map((ticket) => ticket.message);
  const overlap = messages(first.train).filter((message) => messages(first.test).includes(message));
  assert.deepEqual(overlap, []);
});

test('TfidfVectorizer produce vectores L2 normalizados e ignora términos nuevos', () => {
  const vectorizer = new TfidfVectorizer().fit(['no puedo entrar', 'no puedo entrar', 'error grave']);
  const [vector] = vectorizer.transform(['NO PUEDO ENTRAR, ¡palabra nueva!']);
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  assert.ok(Math.abs(norm - 1) < 1e-10);
  assert.equal(vectorizer.vocabulary.has('palabra'), false);
  assert.throws(() => new TfidfVectorizer().transform(['hola']), /fit/);
});

test('analyzeMl respeta el contrato común y fuerza revisión en seguridad', () => {
  const result = analyzeMl('Alguien entró a mi cuenta sin autorización', model);
  assert.equal(result.category, 'SECURITY');
  assert.equal(result.priority, 'HIGH');
  assert.equal(result.requiresHumanReview, true);
  assert.equal(result.mode, 'ml');
  assert.ok(result.response.length > 0);
  assert.deepEqual(Object.keys(result).sort(), ['category', 'mode', 'priority', 'requiresHumanReview', 'response']);

  for (const message of [null, undefined, 123, {}, '', '   ', 'a'.repeat(5001)]) {
    assert.throws(() => analyzeMl(message, model), TypeError);
  }
});

test('evaluateModel y formatClassificationReport devuelven métricas por categoría', () => {
  const { train, test } = trainTestSplit(tickets);
  const heldOutModel = trainModel(train);
  const report = evaluateModel(heldOutModel, test);
  assert.equal(report.support, test.length);
  assert.equal(Object.keys(report.perClass).length, 4);
  assert.ok(report.accuracy >= 0 && report.accuracy <= 1);
  for (const values of Object.values(report.perClass)) {
    assert.ok(values.precision >= 0 && values.precision <= 1);
    assert.ok(values.recall >= 0 && values.recall <= 1);
    assert.ok(values.f1 >= 0 && values.f1 <= 1);
    assert.ok(values.support > 0);
  }
  const text = formatClassificationReport(report);
  assert.match(text, /precision\s+recall\s+f1-score\s+support/);
  assert.match(text, /accuracy/);
  assert.match(text, /macro avg/);
  assert.match(text, /weighted avg/);
});
