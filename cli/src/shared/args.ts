export interface ParsedArgs {
  positionals: string[];
  flags: Map<string, string | true>;
}

/**
 * Parser mínimo, na mesma linha do que `deploy-functions-individually.cjs` já faz à mão: aceita
 * `--flag`, `--flag valor` e `--flag=valor`. Não há biblioteca de CLI no repositório e este milestone
 * não é motivo para introduzir uma.
 */
export const parseArgs = (argv: string[]): ParsedArgs => {
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const body = token.slice(2);
    const equals = body.indexOf('=');

    if (equals !== -1) {
      flags.set(body.slice(0, equals), body.slice(equals + 1));
      continue;
    }

    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags.set(body, next);
      index += 1;
    } else {
      flags.set(body, true);
    }
  }

  return { positionals, flags };
};

export const flagValue = (args: ParsedArgs, name: string): string | undefined => {
  const value = args.flags.get(name);
  return typeof value === 'string' ? value : undefined;
};

export const hasFlag = (args: ParsedArgs, name: string): boolean => args.flags.has(name);

/** Falha cedo e com o nome do que faltou, em vez de deixar o comando descobrir no meio. */
export const requiredFlag = (args: ParsedArgs, name: string): string => {
  const value = flagValue(args, name);
  if (value === undefined || value === '') {
    throw new Error(`Missing required option --${name}.`);
  }
  return value;
};
