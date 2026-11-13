export interface ServerSentEvent {
  event: string | null;
  data: string;
}

/**
 * Lê um corpo `text/event-stream` evento a evento. Escrito à mão, e não com uma biblioteca, porque
 * os cinco provedores usam o MESMO formato e o que cada um precisa é só `event` + `data`: um parser
 * de vinte linhas que todos compartilham custa menos que uma dependência a mais no backend.
 *
 * Linhas `data:` consecutivas se juntam com `\n` (é o que a especificação manda); comentário (`:`) e
 * `id`/`retry` são ignorados. O evento termina na linha em branco — inclusive a última, sem quebra
 * final, que alguns provedores omitem.
 */
export async function* readServerSentEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ServerSentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event: string | null = null;
  let data: string[] = [];

  const flush = (): ServerSentEvent | null => {
    if (data.length === 0) {
      event = null;
      return null;
    }
    const out = { event, data: data.join('\n') };
    event = null;
    data = [];
    return out;
  };

  const consumeLine = (raw: string): ServerSentEvent | null => {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (line === '') return flush();
    if (line.startsWith(':')) return null;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
    return null;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const out = consumeLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (out) yield out;
        newline = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    if (buffer) {
      const out = consumeLine(buffer);
      if (out) yield out;
    }
    const last = flush();
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}

/** Os `data` de um stream, já como JSON. `[DONE]` (o terminador da OpenAI e da Mistral) encerra. */
export async function* readJsonEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string | null; json: Record<string, unknown> }> {
  for await (const { event, data } of readServerSentEvents(body)) {
    if (data === '[DONE]') return;
    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch {
      continue;
    }
    if (json && typeof json === 'object') yield { event, json: json as Record<string, unknown> };
  }
}
