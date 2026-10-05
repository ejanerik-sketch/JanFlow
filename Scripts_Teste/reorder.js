const fs = require('fs');
const content = fs.readFileSync('app/reports/page.tsx', 'utf-8');

// The blocks to move:
// 1. Summary Metrics ends at line 919 (approx): `        </div>\n\n        {/* Cards and Installments Analysis */}`
// 2. Cards and Installments ends at line 972 (approx): `          </div>\n        </div>\n\n        {viewMode === 'anual' && (`
// 3. Daily/Monthly Analysis starts at: `        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">\n          {/* Daily/Monthly Analysis */}`
// and ends at `            </div>\n          </div>\n\n        {/* Compras Parceladas */}`

const cardsMarker = `        {/* Cards and Installments Analysis */}`;
const dailyMarker = `        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">\n          {/* Daily/Monthly Analysis */}`;
const comprasMarker = `        {/* Compras Parceladas */}`;
const annualMarker = `        {viewMode === 'anual' && (`;

const pCards = content.indexOf(cardsMarker);
const pDaily = content.indexOf(dailyMarker);
const pCompras = content.indexOf(comprasMarker);

if (pCards === -1 || pDaily === -1 || pCompras === -1) {
  console.log("Markers not found");
  process.exit(1);
}

// Block A: Before Cards
const blockA = content.slice(0, pCards);

// Block B: Cards + Annual (everything up to Daily)
const blockB = content.slice(pCards, pDaily);

// Block C: Daily (up to Compras)
const blockC = content.slice(pDaily, pCompras);

// Block D: Compras and beyond
const blockD = content.slice(pCompras);

// New order: Block A + Block C + Block B + Block D
// Wait, Daily should have a bottom margin. Let's add mb-8 to its root div
const modifiedBlockC = blockC.replace(
  `<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">`, 
  `<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">`
);

const newContent = blockA + modifiedBlockC + blockB + blockD;

// Also fix the category despesa bug
const fixedCategory = newContent.replace(
  /if \(t\.type === 'despesa'\) \{/g,
  `if (t.type !== 'receita') {`
);

fs.writeFileSync('app/reports/page.tsx', fixedCategory);
console.log("Reordered successfully");
