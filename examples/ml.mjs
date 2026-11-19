import {
  analyzeMl,
  evaluateModel,
  formatClassificationReport,
  loadTickets,
  trainModel,
  trainTestSplit,
} from '../src/ml.mjs';

// Equivalente al script de Python: cargar datos, dividir, entrenar, evaluar
// y clasificar un mensaje nuevo con el modelo ya entrenado.
const tickets = loadTickets();
const { train, test } = trainTestSplit(tickets);
const model = trainModel(train);
const report = evaluateModel(model, test);

console.log(`Tickets: ${tickets.length} | entrenamiento: ${train.length} | prueba: ${test.length} | semilla: 42`);
console.log(formatClassificationReport(report));
console.log('\nPredicción de ejemplo:');
console.log(JSON.stringify(analyzeMl('Alguien entró a mi cuenta sin autorización', model), null, 2));
