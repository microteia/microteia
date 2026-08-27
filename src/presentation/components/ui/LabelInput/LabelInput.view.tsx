import React from 'react';
import { Input, Textarea } from '../Input';
import { useLabelInputViewModel, type LabelInputProps } from './LabelInput.viewmodel';

export const LabelInput: React.FC<LabelInputProps> = (props) => {
  const vm = useLabelInputViewModel(props);

  const shared = {
    value: vm.shown,
    onFocus: vm.handleFocus,
    onBlur: vm.handleBlur,
    placeholder: props.placeholder,
    disabled: props.disabled,
    // A referência não é frase, é identificador: quem a vê aqui está descobrindo que o texto vem do
    // catálogo de uma extensão, e identificador não traduz.
    title: vm.showingTranslation ? props.value : undefined,
  };

  if (props.as) {
    const Field = props.as;
    return (
      <Field
        {...shared}
        rows={props.multiline ? (props.rows ?? 3) : undefined}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => vm.handleChange(e.target.value)}
      />
    );
  }

  if (props.multiline) {
    return (
      <Textarea
        {...shared}
        rows={props.rows ?? 3}
        onChange={(e) => vm.handleChange(e.target.value)}
      />
    );
  }

  return (
    <Input
      {...shared}
      $hasError={props.hasError}
      onChange={(e) => vm.handleChange(e.target.value)}
    />
  );
};
