import styled from 'styled-components';
import { S as Base } from '../../../../components/layout/NotificationBell/NotificationBell.styles';

const NARROW = '640px';

/**
 * No celular o sino não fica na borda — o avatar vem depois dele —, e o painel ancorado no botão
 * vazava pela esquerda. Ali o Wrapper deixa de ser o ancestral posicionado: o painel se ancora no
 * cabeçalho (sticky, de largura inteira) e ocupa a largura da tela com o mesmo respiro das bordas.
 */
export const S = {
  ...Base,

  Wrapper: styled(Base.Wrapper)`
    @media (max-width: ${NARROW}) {
      position: static;
    }
  `,

  Panel: styled(Base.Panel)`
    @media (max-width: ${NARROW}) {
      left: ${({ theme }) => theme.spacing.md};
      right: ${({ theme }) => theme.spacing.md};
      width: auto;
      max-width: none;
    }
  `,
};
