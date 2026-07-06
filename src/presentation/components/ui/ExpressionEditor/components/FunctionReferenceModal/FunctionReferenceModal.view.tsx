import React from 'react';
import { Modal } from '../../../Modal';
import { S } from './FunctionReferenceModal.styles';
import { EXPRESSION_FUNCTIONS } from '../../ExpressionEditor.viewmodel';

export interface FunctionReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DATE_FUNCTIONS = EXPRESSION_FUNCTIONS.filter((f) => ['today', 'now'].includes(f.name));
const STRING_FUNCTIONS = EXPRESSION_FUNCTIONS.filter((f) => ['concat', 'lower', 'upper', 'length'].includes(f.name));
const CONDITIONAL_FUNCTIONS = EXPRESSION_FUNCTIONS.filter((f) => f.name === 'if');

export const FunctionReferenceModal: React.FC<FunctionReferenceModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <Modal title="Referência de Expressões" onClose={onClose} size="medium">
      <S.Content>
        <S.Section>
          <S.SectionTitle>Funções de Data</S.SectionTitle>
          {DATE_FUNCTIONS.map((fn) => (
            <S.FunctionCard key={fn.name}>
              <S.FunctionHeader>
                <S.FunctionName>{fn.name}</S.FunctionName>
                <S.Signature>{fn.signature}</S.Signature>
              </S.FunctionHeader>
              <S.Description>{fn.description}</S.Description>
              <S.ExampleLabel>Exemplo</S.ExampleLabel>
              <S.Example>{fn.example}</S.Example>
            </S.FunctionCard>
          ))}
        </S.Section>

        <S.Section>
          <S.SectionTitle>Funções de Texto</S.SectionTitle>
          {STRING_FUNCTIONS.map((fn) => (
            <S.FunctionCard key={fn.name}>
              <S.FunctionHeader>
                <S.FunctionName>{fn.name}</S.FunctionName>
                <S.Signature>{fn.signature}</S.Signature>
              </S.FunctionHeader>
              <S.Description>{fn.description}</S.Description>
              <S.ExampleLabel>Exemplo</S.ExampleLabel>
              <S.Example>{fn.example}</S.Example>
            </S.FunctionCard>
          ))}
        </S.Section>

        <S.Section>
          <S.SectionTitle>Funções Condicionais</S.SectionTitle>
          {CONDITIONAL_FUNCTIONS.map((fn) => (
            <S.FunctionCard key={fn.name}>
              <S.FunctionHeader>
                <S.FunctionName>{fn.name}</S.FunctionName>
                <S.Signature>{fn.signature}</S.Signature>
              </S.FunctionHeader>
              <S.Description>{fn.description}</S.Description>
              <S.ExampleLabel>Exemplo</S.ExampleLabel>
              <S.Example>{fn.example}</S.Example>
            </S.FunctionCard>
          ))}
        </S.Section>

        <S.Section>
          <S.SectionTitle>Operadores</S.SectionTitle>
          <S.OperatorsInfo>
            <S.OperatorList>
              <S.OperatorItem>
                <S.OperatorSymbol>+</S.OperatorSymbol>
                <span>Soma números ou adiciona dias a uma data</span>
              </S.OperatorItem>
              <S.OperatorItem>
                <S.OperatorSymbol>-</S.OperatorSymbol>
                <span>Subtrai números ou remove dias de uma data</span>
              </S.OperatorItem>
            </S.OperatorList>
          </S.OperatorsInfo>
        </S.Section>
      </S.Content>
    </Modal>
  );
};
