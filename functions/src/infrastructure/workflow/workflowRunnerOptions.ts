/**
 * A memória de toda function que EXECUTA passos de automação — e não só a do barramento: o relógio
 * retoma o `delay`, a caixa decide a aprovação, o botão e o portal rodam a ação ali mesmo. Qualquer uma
 * delas pode chegar a um `read-document`.
 *
 * Os 256 MiB padrão não cabiam: carregar o código das functions já ocupa mais da metade, a `pdfjs-dist`
 * soma ~50 MiB na primeira leitura, e a instância atende várias execuções ao mesmo tempo. Um PDF de
 * 270 KB derrubava a instância por memória, e a execução sumia sem histórico (issue #6). O GiB cobre o
 * teto de `READ_DOCUMENT_MAX_BYTES` com folga, porque `PdfjsTextExtractor` abre um PDF por vez.
 */
export const WORKFLOW_RUNNER_MEMORY = '1GiB' as const;
