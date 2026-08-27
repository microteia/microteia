// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { LabelInput } from './LabelInput.view';

/**
 * O contrato inteiro do componente cabe numa frase: para FORA, `value` e `onChange` são sempre o
 * valor real; a tradução existe só na tela, e só enquanto ninguém está editando.
 *
 * Os dois defeitos que ele impede são simétricos, e é por isso que os dois têm teste aqui: mostrar a
 * referência crua deixa na tela um texto que ninguém lê, e mostrar o traduzido faz o próximo "Salvar"
 * gravar o texto por cima da referência — apagando a tradução dos outros idiomas.
 */
vi.mock('../../../shared/i18n/useT', () => ({
  useLabel: () => (value: string | null | undefined) =>
    (value === '@com.acme.auto/workflow.mirror' ? 'Manter o resumo em dia' : (value ?? '')),
}));

vi.mock('styled-components', async () => {
  const React = await import('react');
  const passthrough = (tag: string) => {
    const factory = () => {
      const Component = (props: Record<string, unknown>) => {
        const clean = Object.fromEntries(Object.entries(props).filter(([key]) => !key.startsWith('$')));
        return React.createElement(tag, clean);
      };
      return Component;
    };
    return factory;
  };
  return {
    default: { input: passthrough('input'), textarea: passthrough('textarea'), div: passthrough('div'), label: passthrough('label'), span: passthrough('span'), select: passthrough('select') },
  };
});

const REF = '@com.acme.auto/workflow.mirror';

describe('LabelInput — a tradução é só para ver', () => {
  it('em repouso mostra o texto traduzido, não a referência', () => {
    const { container } = render(<LabelInput value={REF} onChange={vi.fn()} />);
    const input = container.querySelector('input')!;

    expect(input.value).toBe('Manter o resumo em dia');
  });

  it('ao receber o foco, revela o valor real — que é o que se vai alterar', () => {
    const { container } = render(<LabelInput value={REF} onChange={vi.fn()} />);
    const input = container.querySelector('input')!;

    fireEvent.focus(input);

    expect(input.value).toBe(REF);
  });

  it('ao perder o foco sem digitar, volta a mostrar a tradução — o valor não mudou', () => {
    const onChange = vi.fn();
    const { container } = render(<LabelInput value={REF} onChange={onChange} />);
    const input = container.querySelector('input')!;

    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(input.value).toBe('Manter o resumo em dia');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('o que sai no onChange é o valor REAL digitado, nunca o traduzido', () => {
    const onChange = vi.fn();
    const { container } = render(<LabelInput value={REF} onChange={onChange} />);
    const input = container.querySelector('input')!;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Recontar o resumo' } });

    expect(onChange).toHaveBeenCalledWith('Recontar o resumo');
    expect(onChange).not.toHaveBeenCalledWith('Manter o resumo em dia');
  });

  it('texto do escritório não tem nada escondido: se comporta como um campo comum', () => {
    const { container } = render(<LabelInput value="Contrato de Locação" onChange={vi.fn()} />);
    const input = container.querySelector('input')!;

    expect(input.value).toBe('Contrato de Locação');
    fireEvent.focus(input);
    expect(input.value).toBe('Contrato de Locação');
    expect(input.getAttribute('title')).toBeNull();
  });

  it('enquanto mostra a tradução, a dica do campo diz de onde o texto vem', () => {
    const { container } = render(<LabelInput value={REF} onChange={vi.fn()} />);
    const input = container.querySelector('input')!;

    expect(input.getAttribute('title')).toBe(REF);
    fireEvent.focus(input);
    expect(input.getAttribute('title')).toBeNull();
  });

  it('o campo próprio de uma tela segue a mesma regra — é só a forma que muda', () => {
    const Proprio = (props: Record<string, unknown>) => <input data-proprio="1" {...props} />;
    const onChange = vi.fn();
    const { container } = render(<LabelInput as={Proprio} value={REF} onChange={onChange} />);
    const input = container.querySelector('input[data-proprio]') as HTMLInputElement;

    expect(input.value).toBe('Manter o resumo em dia');
    fireEvent.focus(input);
    expect(input.value).toBe(REF);
    fireEvent.change(input, { target: { value: 'Recontar' } });
    expect(onChange).toHaveBeenCalledWith('Recontar');
  });

  it('a versão de várias linhas segue a mesma regra', () => {
    const { container } = render(<LabelInput multiline value={REF} onChange={vi.fn()} />);
    const textarea = container.querySelector('textarea')!;

    expect(textarea.value).toBe('Manter o resumo em dia');
    fireEvent.focus(textarea);
    expect(textarea.value).toBe(REF);
  });
});
