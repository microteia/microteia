/**
 * Script para adicionar minArgs e maxArgs nas definições de ExpressionFunction
 * 
 * Analisa cada arquivo e adiciona os campos baseando-se nas assinaturas existentes
 */

const fs = require('fs');
const path = require('path');

// Mapeamento manual de funções para suas regras de argumentos
const FUNCTION_ARGS = {
  // Data
  today: { minArgs: 0, maxArgs: 0 },
  now: { minArgs: 0, maxArgs: 0 },
  formatDate: { minArgs: 2, maxArgs: 2 },
  addDays: { minArgs: 2, maxArgs: 2 },
  dateDiff: { minArgs: 2, maxArgs: 3 },
  dayOfWeek: { minArgs: 1, maxArgs: 1 },
  isWeekend: { minArgs: 1, maxArgs: 1 },
  year: { minArgs: 1, maxArgs: 1 },
  month: { minArgs: 1, maxArgs: 1 },
  day: { minArgs: 1, maxArgs: 1 },
  
  // Math
  round: { minArgs: 1, maxArgs: 2 },
  floor: { minArgs: 1, maxArgs: 1 },
  ceil: { minArgs: 1, maxArgs: 1 },
  abs: { minArgs: 1, maxArgs: 1 },
  min: { minArgs: 1 },
  max: { minArgs: 1 },
  sum: { minArgs: 1, maxArgs: 1 },
  avg: { minArgs: 1, maxArgs: 1 },
  
  // Array
  first: { minArgs: 1, maxArgs: 1 },
  last: { minArgs: 1, maxArgs: 1 },
  contains: { minArgs: 2, maxArgs: 2 },
  indexOf: { minArgs: 2, maxArgs: 2 },
  
  // Logic
  if: { minArgs: 3, maxArgs: 3 },
  and: { minArgs: 1 },
  or: { minArgs: 1 },
  not: { minArgs: 1, maxArgs: 1 },
  isEmpty: { minArgs: 1, maxArgs: 1 },
  isNull: { minArgs: 1, maxArgs: 1 },
  isNotNull: { minArgs: 1, maxArgs: 1 },
  coalesce: { minArgs: 1 },
  
  // Validation
  isCPF: { minArgs: 1, maxArgs: 1 },
  isCNPJ: { minArgs: 1, maxArgs: 1 },
  isEmail: { minArgs: 1, maxArgs: 1 },
  formatCPF: { minArgs: 1, maxArgs: 1 },
  formatCNPJ: { minArgs: 1, maxArgs: 1 },
  
  // Misc
  getVar: { minArgs: 1, maxArgs: 1 },
};

function addArgsToFunction(content, functionName, args) {
  // Encontra a definição da função
  const functionPattern = new RegExp(
    `export const ${functionName}Fn: ExpressionFunction = \\{([^}]+category: '[^']+',)`,
    's'
  );
  
  const match = content.match(functionPattern);
  if (!match) {
    console.log(`  ⚠️  Função ${functionName} não encontrada ou já processada`);
    return content;
  }
  
  // Adiciona minArgs e maxArgs
  let replacement = match[1];
  replacement += `\n  minArgs: ${args.minArgs},`;
  if (args.maxArgs !== undefined) {
    replacement += `\n  maxArgs: ${args.maxArgs},`;
  }
  
  const newContent = content.replace(
    functionPattern,
    `export const ${functionName}Fn: ExpressionFunction = {${replacement}`
  );
  
  console.log(`  ✓ ${functionName}: minArgs=${args.minArgs}${args.maxArgs !== undefined ? `, maxArgs=${args.maxArgs}` : ''}`);
  return newContent;
}

function processFile(filePath) {
  console.log(`\nProcessando ${path.basename(filePath)}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Procura por funções neste arquivo
  for (const [fnName, args] of Object.entries(FUNCTION_ARGS)) {
    if (content.includes(`export const ${fnName}Fn`)) {
      const newContent = addArgsToFunction(content, fnName, args);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  📝 Arquivo atualizado!`);
  } else {
    console.log(`  - Nenhuma alteração necessária`);
  }
}

// Processa todos os arquivos de builtins
const builtinsDir = path.join(__dirname, '../src/domain/engine/expression/builtins');
const files = fs.readdirSync(builtinsDir)
  .filter(f => f.endsWith('.ts') && f !== 'operators.ts')
  .map(f => path.join(builtinsDir, f));

console.log('=== Adicionando minArgs e maxArgs ===\n');
files.forEach(processFile);
console.log('\n✅ Concluído!');
