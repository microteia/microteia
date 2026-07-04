import React from 'react';
import { usePublicFooterViewModel } from './PublicFooter.viewmodel';
import { S } from './PublicFooter.styles';

export const PublicFooter: React.FC = () => {
  const vm = usePublicFooterViewModel();

  return (
    <S.Footer>
      <S.Content>
        <S.Brand>
          <img src="/logo.png" alt="Curatino" />
          <span>Curatino</span>
        </S.Brand>

        <S.LinkGroup>
          <S.GroupTitle>Produto</S.GroupTitle>
          {vm.productLinks.map((link) => (
            <S.Link key={link.to} onClick={() => vm.goTo(link.to)}>
              {link.label}
            </S.Link>
          ))}
        </S.LinkGroup>

        <S.LinkGroup>
          <S.GroupTitle>Legal</S.GroupTitle>
          {vm.legalLinks.map((link) => (
            <S.Link key={link.to} onClick={() => vm.goTo(link.to)}>
              {link.label}
            </S.Link>
          ))}
        </S.LinkGroup>

        <S.LinkGroup>
          <S.GroupTitle>Contato</S.GroupTitle>
          <S.EmailLink href={`mailto:${vm.contactEmail}`}>{vm.contactEmail}</S.EmailLink>
        </S.LinkGroup>
      </S.Content>

      <S.Bottom>© 2026 Curatino. Todos os direitos reservados.</S.Bottom>
    </S.Footer>
  );
};
