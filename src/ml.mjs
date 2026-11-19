import { readFileSync } from 'node:fs';
import { MAX_MESSAGE_LENGTH } from './contract.mjs';
import { CATEGORY_RESPONSES, normalizeText, priorityFor } from './traditional.mjs';

// Adaptación del flujo de Python (pandas + scikit-learn) a JavaScript puro:
// CSV -> división estratificada -> TF-IDF (1-2 gramas) -> regresión logística
// -> informe de clasificación -> predicción de un mensaje nuevo.
const TICKETS_URL = new URL('../fixtures/tickets.csv', import.meta.url);
const DEFAULT_NGRAM_RANGE = [1, 2];
const DEFAULT_TEST_SIZE = 0.2;
const DEFAULT_SEED = 42;
const REVIEW_CONFIDENCE = 0.6;

/** Parser CSV mínimo (cabecera, comillas y comas dentro de comillas). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  const [header, ...values] = rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
  if (!header) return [];
  return values.map((cells) => Object.fromEntries(
    header.map((name, index) => [name.trim(), (cells[index] ?? '').trim()]),
  ));
}

/** Lee el reemplazo de tickets.csv: filas con `message` y `category`. */
export function loadTickets(url = TICKETS_URL) {
  const tickets = parseCsv(readFileSync(url, 'utf8')).map(({ message, category }) => ({ message, category }));
  if (!tickets.length) throw new Error('El CSV de tickets está vacío.');
  for (const ticket of tickets) {
    if (!ticket.message || !ticket.category) {
      throw new Error('Cada fila del CSV debe tener message y category.');
    }
  }
  return tickets;
}

function tokenize(text) {
  // Equivale al token_pattern de TfidfVectorizer: palabras de 2+ caracteres,
  // ignorando acentos y mayúsculas como en el motor tradicional.
  return normalizeText(text).match(/[a-z0-9]{2,}/g) ?? [];
}

function ngrams(tokens, [minN, maxN]) {
  const terms = [];
  for (let n = minN; n <= maxN; n += 1) {
    for (let i = 0; i + n <= tokens.length; i += 1) {
      terms.push(tokens.slice(i, i + n).join(' '));
    }
  }
  return terms;
}

/** Vectorizador TF-IDF con normalización L2 y vocabulario entrenado. */
export class TfidfVectorizer {
  constructor({ ngramRange = DEFAULT_NGRAM_RANGE } = {}) {
    this.ngramRange = ngramRange;
  }

  fit(corpus) {
    this.vocabulary = new Map();
    const documentFrequency = new Map();

    for (const document of corpus) {
      for (const term of new Set(ngrams(tokenize(document), this.ngramRange))) {
        documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
      }
    }

    [...documentFrequency.keys()].sort().forEach((term, index) => this.vocabulary.set(term, index));
    this.idf = new Float64Array(this.vocabulary.size);
    for (const [term, frequency] of documentFrequency) {
      const index = this.vocabulary.get(term);
      this.idf[index] = Math.log((1 + corpus.length) / (1 + frequency)) + 1;
    }
    return this;
  }

  transform(corpus) {
    if (!this.vocabulary) throw new Error('El vectorizador debe entrenarse con fit antes de transformar.');
    return corpus.map((document) => {
      const counts = new Map();
      for (const term of ngrams(tokenize(document), this.ngramRange)) {
        const index = this.vocabulary.get(term);
        if (index !== undefined) counts.set(index, (counts.get(index) ?? 0) + 1);
      }

      const vector = new Float64Array(this.vocabulary.size);
      let norm = 0;
      for (const [index, count] of counts) {
        const value = count * this.idf[index];
        vector[index] = value;
        norm += value * value;
      }
      norm = Math.sqrt(norm);
      if (norm > 0) {
        for (let i = 0; i < vector.length; i += 1) vector[i] /= norm;
      }
      return vector;
    });
  }
}

function softmax(scores) {
  const max = Math.max(...scores);
  const exponentials = scores.map((score) => Math.exp(score - max));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

/** Regresión logística multiclase (softmax) entrenada por descenso de gradiente. */
export class LogisticRegression {
  constructor({ epochs = 800, learningRate = 1, l2 = 1e-4 } = {}) {
    this.epochs = epochs;
    this.learningRate = learningRate;
    this.l2 = l2;
  }

  fit(X, y, classes = [...new Set(y)].sort()) {
    if (!X.length) throw new Error('No hay datos de entrenamiento.');
    this.classes = classes;
    const dimensions = X[0].length;
    const labels = y.map((label) => this.classes.indexOf(label));
    const gradients = this.classes.map(() => new Float64Array(dimensions));
    this.weights = this.classes.map(() => new Float64Array(dimensions));

    for (let epoch = 0; epoch < this.epochs; epoch += 1) {
      for (const gradient of gradients) gradient.fill(0);
      for (let i = 0; i < X.length; i += 1) {
        const probabilities = softmax(this.weights.map((weight) => dot(weight, X[i])));
        for (let c = 0; c < this.classes.length; c += 1) {
          const error = probabilities[c] - (labels[i] === c ? 1 : 0);
          const gradient = gradients[c];
          for (let j = 0; j < dimensions; j += 1) gradient[j] += error * X[i][j];
        }
      }
      for (let c = 0; c < this.classes.length; c += 1) {
        for (let j = 0; j < dimensions; j += 1) {
          this.weights[c][j] -= this.learningRate
            * (gradients[c][j] / X.length + this.l2 * this.weights[c][j]);
        }
      }
    }
    return this;
  }

  predictProba(X) {
    return X.map((row) => softmax(this.weights.map((weight) => dot(weight, row))));
  }

  predict(X) {
    return this.predictProba(X).map((probabilities) => {
      let best = 0;
      for (let i = 1; i < probabilities.length; i += 1) {
        if (probabilities[i] > probabilities[best]) best = i;
      }
      return this.classes[best];
    });
  }
}

function dot(a, b) {
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result += a[i] * b[i];
  return result;
}

function mulberry32(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** División estratificada equivalente a train_test_split(stratify=category). */
export function trainTestSplit(tickets, { testSize = DEFAULT_TEST_SIZE, seed = DEFAULT_SEED } = {}) {
  const random = mulberry32(seed);
  const byCategory = new Map();
  for (const ticket of tickets) {
    if (!byCategory.has(ticket.category)) byCategory.set(ticket.category, []);
    byCategory.get(ticket.category).push(ticket);
  }

  const train = [];
  const test = [];
  for (const category of [...byCategory.keys()].sort()) {
    const group = shuffle([...byCategory.get(category)], random);
    const testCount = Math.min(group.length - 1, Math.max(1, Math.round(group.length * testSize)));
    test.push(...group.slice(0, testCount));
    train.push(...group.slice(testCount));
  }
  return { train: shuffle(train, random), test: shuffle(test, random) };
}

/** Entrena el vectorizador y el clasificador con las filas recibidas. */
export function trainModel(tickets, options = {}) {
  const vectorizer = new TfidfVectorizer(options);
  const matrix = vectorizer.fit(tickets.map((ticket) => ticket.message))
    .transform(tickets.map((ticket) => ticket.message));
  const classifier = new LogisticRegression(options).fit(
    matrix,
    tickets.map((ticket) => ticket.category),
  );
  return { vectorizer, classifier };
}

/** Métricas por categoría con el mismo formato conceptual de classification_report. */
export function evaluateModel(model, tickets) {
  const matrix = model.vectorizer.transform(tickets.map((ticket) => ticket.message));
  const predicted = model.classifier.predict(matrix);
  const actual = tickets.map((ticket) => ticket.category);
  const classes = model.classifier.classes;
  const perClass = {};

  for (const category of classes) {
    let truePositive = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    for (let i = 0; i < actual.length; i += 1) {
      if (actual[i] === category && predicted[i] === category) truePositive += 1;
      else if (predicted[i] === category) falsePositive += 1;
      else if (actual[i] === category) falseNegative += 1;
    }
    const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : 0;
    const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : 0;
    perClass[category] = {
      precision,
      recall,
      f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
      support: truePositive + falseNegative,
    };
  }

  const accuracy = actual.reduce((count, label, i) => count + (label === predicted[i] ? 1 : 0), 0)
    / (actual.length || 1);
  const average = (key) => classes.reduce((sum, category) => sum + perClass[category][key], 0) / classes.length;
  const weighted = (key) => classes.reduce(
    (sum, category) => sum + perClass[category][key] * perClass[category].support,
    0,
  ) / (actual.length || 1);

  return {
    perClass,
    accuracy,
    macroAvg: { precision: average('precision'), recall: average('recall'), f1: average('f1') },
    weightedAvg: { precision: weighted('precision'), recall: weighted('recall'), f1: weighted('f1') },
    support: actual.length,
  };
}

/** Representación textual similar a la salida de sklearn. */
export function formatClassificationReport(report) {
  const line = (label, values) => [
    label.padEnd(12),
    values.precision.toFixed(2).padStart(9),
    values.recall.toFixed(2).padStart(9),
    values.f1.toFixed(2).padStart(9),
    String(values.support ?? report.support).padStart(9),
  ].join('');

  return [
    '              precision    recall  f1-score   support',
    '',
    ...Object.entries(report.perClass).map(([category, values]) => line(category, values)),
    '',
    line('accuracy', { precision: report.accuracy, recall: report.accuracy, f1: report.accuracy }),
    line('macro avg', report.macroAvg),
    line('weighted avg', report.weightedAvg),
  ].join('\n');
}

let defaultModel = null;

/** Modelo único entrenado al primer uso, reutilizado por todas las peticiones. */
export function getModel() {
  if (!defaultModel) defaultModel = trainModel(loadTickets());
  return defaultModel;
}

/** Clasifica con el modelo entrenado y devuelve el contrato común del proyecto. */
export function analyzeMl(message, model = getModel()) {
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
    throw new TypeError(`El mensaje debe ser un texto de entre 1 y ${MAX_MESSAGE_LENGTH} caracteres y no estar vacío.`);
  }

  const probabilities = model.classifier.predictProba(model.vectorizer.transform([message]))[0];
  let best = 0;
  for (let i = 1; i < probabilities.length; i += 1) {
    if (probabilities[i] > probabilities[best]) best = i;
  }
  const category = model.classifier.classes[best];
  const text = normalizeText(message);

  return {
    category,
    priority: priorityFor(category, text),
    response: CATEGORY_RESPONSES[category],
    requiresHumanReview: category === 'SECURITY' || probabilities[best] < REVIEW_CONFIDENCE,
    mode: 'ml',
  };
}
