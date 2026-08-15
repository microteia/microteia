/**
 * Uma mensagem produzida pelo DOMÍNIO, que não conhece idioma: a `message` é sempre uma referência
 * (`@core.automation/…`) e os `messageParams` são os valores que a frase interpola.
 *
 * Existe como tipo único, e não como um `{ message, params }` reinventado em cada validação, porque
 * o formato é o contrato entre quem produz o problema (schema, kernel, backend) e quem o exibe. Um
 * segundo formato obrigaria cada tela a saber de qual validação o problema veio para saber resolvê-lo.
 */
export interface LocalizedMessage {
  message: string;
  messageParams?: Record<string, string>;
}
