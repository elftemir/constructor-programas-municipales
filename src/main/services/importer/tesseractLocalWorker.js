require('./blockOcrNetwork');
// In 7.0.0, the dispatcher supplies a boolean lstmOnly but the Node adapter
// compares it with numeric OEM values. Adapt that contract without changing vendor files.
const adapterPath = require.resolve('./node_modules/tesseract.js/src/worker-script/node/getCore');
const getCore = require(adapterPath);
require.cache[adapterPath].exports = (lstmOnly, corePath, progress) =>
  getCore(lstmOnly === true ? 1 : lstmOnly === false ? 0 : lstmOnly, corePath, progress);
require('./node_modules/tesseract.js/src/worker-script/node');
