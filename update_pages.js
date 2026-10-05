const fs = require('fs');

function updatePage(path) {
  let content = fs.readFileSync(path, 'utf8');

  // 1. Add import
  if (!content.includes('CategoryTransactionsModal')) {
    content = content.replace(
      "import { TransactionModal }",
      "import { CategoryTransactionsModal } from '@/components/CategoryTransactionsModal';\nimport { TransactionModal }"
    );
  }

  // 2. Add state
  if (!content.includes('selectedCategoryModal')) {
    content = content.replace(
      "const [selectedMonth, setSelectedMonth]",
      "const [selectedCategoryModal, setSelectedCategoryModal] = useState<string | null>(null);\n  const [selectedMonth, setSelectedMonth]"
    );
  }

  // 3. Make category items clickable
  const clickableItem = `                    <div 
                      key={index} 
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer"
                      onClick={() => setSelectedCategoryModal(entry.name)}
                    >`;
                    
  content = content.replace(
    /key=\{index\} className="flex items-center justify-between"/g,
    `key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer" onClick={() => setSelectedCategoryModal(entry.name)}`
  );

  // 4. Add the modal at the end (before last </main>)
  if (!content.includes('<CategoryTransactionsModal')) {
    const modalJSX = `
      <CategoryTransactionsModal
        isOpen={!!selectedCategoryModal}
        onClose={() => setSelectedCategoryModal(null)}
        categoryName={selectedCategoryModal || ''}
        transactions={transactions}
      />
    `;
    content = content.replace(/(<\/main>\s*<\/div>\s*)$/, modalJSX + "$1");
  }

  fs.writeFileSync(path, content);
}

updatePage('app/page.tsx');
updatePage('app/reports/page.tsx');
