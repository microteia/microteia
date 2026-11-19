/**
 * O YAML aqui é um SUBCONJUNTO deliberado: mapas de dois níveis com valores escalares, que é a forma
 * exata do `microteia.yaml`. Não há biblioteca de YAML no repositório, e trazer uma para ler meia dúzia
 * de seções seria pagar uma dependência pela generalidade que não vamos usar. O que o leitor não
 * entende ele REJEITA com o número da linha, em vez de adivinhar.
 *
 * Mora fora de `environment.ts` porque a pasta `brand/` do repositório usa o MESMO bloco `brand:`
 * (ver `vite.config.ts`), e dois leitores do mesmo bloco discordariam um dia.
 */
export type YamlSections = Map<string, Map<string, string | null>>;

const unquote = (raw: string): string | null => {
  const value = raw.trim();
  if (value === '' || value === 'null' || value === '~') return null;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return value;
};

export const parseYamlSections = (source: string, fileName: string): YamlSections => {
  const sections: YamlSections = new Map();
  let current: Map<string, string | null> | null = null;

  const lines = source.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    // O comentário pode estar INDENTADO: o arquivo gerado pelo Console tem um dentro da seção
    // `firebase`, e olhar só a coluna zero faria o leitor rejeitar o que ele mesmo escreveu.
    const withoutComment = line.trim().startsWith('#') ? '' : line;
    if (withoutComment.trim() === '') continue;

    const topLevel = withoutComment.match(/^([A-Za-z][A-Za-z0-9_]*):\s*$/);
    if (topLevel !== null) {
      current = new Map();
      sections.set(topLevel[1], current);
      continue;
    }

    const entry = withoutComment.match(/^ {2}([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
    if (entry !== null) {
      if (current === null) {
        throw new Error(`${fileName} line ${index + 1}: entry outside of any section.`);
      }
      current.set(entry[1], unquote(entry[2]));
      continue;
    }

    throw new Error(`${fileName} line ${index + 1}: unsupported syntax: ${line.trim()}`);
  }

  return sections;
};
