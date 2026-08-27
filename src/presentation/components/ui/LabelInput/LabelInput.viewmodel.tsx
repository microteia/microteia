import type React from 'react';
import { useCallback, useState } from 'react';
import { isMessageRef } from '../../../../domain/schema/i18n/messageRef';
import { useLabel } from '../../../shared/i18n/useT';

export interface LabelInputProps {
  /**
   * O VALOR REAL, sempre — a referência que a extensão declarou (`@ns/chave`) ou o texto que o
   * escritório digitou. Nunca o traduzido: quem lê este campo de fora lê o que será gravado.
   */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  /** Área de texto, para o campo que é descrição e não nome. */
  multiline?: boolean;
  rows?: number;
  /**
   * O campo a renderizar, quando a tela tem o próprio. O comportamento é o mesmo; muda só a forma —
   * e uma tela não deveria ter de escolher entre o estilo dela e traduzir o que mostra.
   */
  as?: React.ElementType;
}

export interface LabelInputViewModel {
  /** O que o campo MOSTRA: o traduzido em repouso, o valor real a partir do momento em que se edita. */
  shown: string;
  /** Verdadeiro só enquanto o que está na tela não é o valor real. */
  showingTranslation: boolean;
  handleFocus: () => void;
  handleBlur: () => void;
  handleChange: (next: string) => void;
}

/**
 * O campo que edita um RÓTULO DECLARATIVO.
 *
 * O problema que ele resolve tinha duas metades que pareciam excluir-se. Mostrar a referência crua
 * (`@com.microteia.automation-example/workflow.mirror`) deixava na tela um texto que ninguém lê;
 * mostrar o traduzido fazia o primeiro "Salvar" gravar *Keep the summary in step* por cima da
 * referência, apagando a tradução de todos os outros idiomas num gesto que parecia não mudar nada.
 *
 * A saída é a tradução existir SÓ para exibição, e só enquanto ninguém está editando: em repouso o
 * campo mostra o texto que se lê; ao receber o foco, revela o valor real, que é o que se vai alterar.
 * Para fora, o componente nunca fala do traduzido — `value` e `onChange` são o valor real dos dois
 * lados, e é por isso que nenhum outro componente precisa saber que isto existe.
 *
 * `isMessageRef` — e não "o traduzido é diferente do valor" — é o que decide se há o que revelar:
 * texto do escritório nunca tem nada escondido atrás dele, e o campo se comporta como um `Input` comum.
 */
export const useLabelInputViewModel = (props: LabelInputProps): LabelInputViewModel => {
  const { value, onChange } = props;
  const label = useLabel();
  const [editing, setEditing] = useState(false);

  const showingTranslation = !editing && isMessageRef(value);

  return {
    shown: showingTranslation ? label(value) : value,
    showingTranslation,
    handleFocus: useCallback(() => setEditing(true), []),
    handleBlur: useCallback(() => setEditing(false), []),
    handleChange: useCallback((next: string) => onChange(next), [onChange]),
  };
};
