// Preserve OCR provenance and confidence after the user confirms an import.
function up(db, { addColumnIfNotExists }) {
  addColumnIfNotExists(db, 'programas_fuente', "ocr_metadata_json TEXT DEFAULT '{}' ");
}
module.exports = { version: 5, name: '005_ocr_metadata', up };
