import React from 'react';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { PublicFooter } from '../../components/layout/PublicFooter';
import { useContactViewModel } from './Contact.viewmodel';
import { S } from './Contact.styles';

export const ContactView: React.FC = () => {
  const vm = useContactViewModel();

  return (
    <S.Page>
      <PublicHeader />

      <S.Main>
        <S.Card>
          <S.Title>Fale com a gente</S.Title>
          <S.Subtitle>
            Tem alguma dúvida sobre o Microteia ou quer conversar sobre o seu escritório? Manda um e-mail direto.
          </S.Subtitle>
          <S.EmailButton href={vm.mailtoHref}>{vm.email}</S.EmailButton>
        </S.Card>
      </S.Main>

      <PublicFooter />
    </S.Page>
  );
};
