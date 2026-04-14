// Test: verify that normalizeComparableText makes the multi-line library answer
// match the single-line extracted option text

function collapseWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripDiacritics(value) {
  return value.normalize('NFKD').replace(/\p{M}+/gu, '');
}

function stripLeadingChoiceMarker(value) {
  return value.replace(/^\s*[(\[]?([a-z]|\d{1,2}|[ivxlcdm]{1,5})[)\].:-]\s+/iu, '');
}

function normalizeBlankMarkers(value) {
  return value
    .replace(/\b(?:fill\s+in\s+the\s+blank|fill-in-the-blank|blank|blanks)\b/giu, ' _ ')
    .replace(/[_\s]*_{2,}[_\s]*/g, ' _ ');
}

function normalizeListMarkers(value) {
  let result = value.replace(
    /([a-zA-Z])((?:viii|vii|vi|iv|ix|xii|xi|iii|ii|x|v|i)\.)(\s|$)/gi,
    '$1 $2$3'
  );
  result = result.replace(
    /([a-zA-Z]{2,})([a-d]\.)(\s|$)/g,
    '$1 $2$3'
  );
  result = result.replace(
    /([a-zA-Z]{2,})(\d{1,2}\.)(\s|$)/g,
    '$1 $2$3'
  );
  return result;
}

function normalizeComparableText(value) {
  return collapseWhitespace(normalizeBlankMarkers(stripLeadingChoiceMarker(stripDiacritics(normalizeListMarkers(value)))))
    .toLowerCase()
    .replace(/;/g, ',')
    .replace(/[\u2713\u2714\u2715\u2716\u2717\u2718✓✗✔✘☑☐⬜⬛●○◉]/g, ' ')
    .replace(/\b(?:your answer is (?:correct|incorrect)|correct|incorrect|partially correct)\b/gi, ' ')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202f\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Library answer (multi-line):
const libraryAnswer = `Evaluating the database server hardware
Installing the Oracle software
Planning the database and security strategy
Creating, migrating, and opening the database
Backing up the database
Enrolling system users and planning for their Oracle Network access.
Implementing the database design
Recovering from database failure
Monitoring database performance`;

// Option b text (single-line, as extracted from DOM textContent):
const optionB = "b. Evaluating the database server hardware Installing the Oracle software Planning the database and security strategy Creating, migrating, and opening the database Backing up the database Enrolling system users and planning for their Oracle Network access. Implementing the database design Recovering from database failure Monitoring database performance";

const normalizedLibrary = normalizeComparableText(libraryAnswer);
const normalizedOption = normalizeComparableText(optionB);

console.log("=== LIBRARY (normalized) ===");
console.log(normalizedLibrary);
console.log("Length:", normalizedLibrary.length);
console.log("");
console.log("=== OPTION B (normalized) ===");
console.log(normalizedOption);
console.log("Length:", normalizedOption.length);
console.log("");
console.log("=== EXACT MATCH ===");
console.log(normalizedLibrary === normalizedOption);
console.log("");
console.log("=== CONTAINS ===");
console.log("Library includes Option:", normalizedLibrary.includes(normalizedOption));
console.log("Option includes Library:", normalizedOption.includes(normalizedLibrary));
console.log("");

// Check length ratio
const shorter = Math.min(normalizedLibrary.length, normalizedOption.length);
const longer = Math.max(normalizedLibrary.length, normalizedOption.length);
console.log("=== LENGTH RATIO ===");
console.log("Ratio:", shorter / longer);
console.log("Passes >= 0.85:", shorter / longer >= 0.85);
