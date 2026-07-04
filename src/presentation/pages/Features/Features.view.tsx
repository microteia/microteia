import React from 'react';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { PublicFooter } from '../../components/layout/PublicFooter';
import { useFeaturesViewModel } from './Features.viewmodel';
import { S } from './Features.styles';

export const FeaturesView: React.FC = () => {
  const vm = useFeaturesViewModel();

  return (
    <S.Page>
      <PublicHeader />

      <S.Intro>
        <S.Title>Tudo que o seu escritório precisa, em um só lugar</S.Title>
        <S.Subtitle>Conheça as funcionalidades do Curatino.</S.Subtitle>
      </S.Intro>

      <S.SectionList>
        {vm.sections.map((section, index) => (
          <S.FeatureRow key={section.title} $reverse={index % 2 === 1}>
            <S.FeatureImage>
              <img src={section.image} alt={section.title} />
            </S.FeatureImage>
            <S.FeatureText>
              <S.FeatureTitle>{section.title}</S.FeatureTitle>
              <S.FeatureDescription>{section.description}</S.FeatureDescription>
            </S.FeatureText>
          </S.FeatureRow>
        ))}
      </S.SectionList>

      <S.CtaBand>
        <S.CtaText>Pronto para organizar seu escritório?</S.CtaText>
        <S.CtaButton onClick={vm.goToLogin}>Comece grátis</S.CtaButton>
      </S.CtaBand>

      <PublicFooter />
    </S.Page>
  );
};
