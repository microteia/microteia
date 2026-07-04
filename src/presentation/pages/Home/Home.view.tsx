import React from 'react';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { PublicFooter } from '../../components/layout/PublicFooter';
import { FullPageSpinner, Spinner } from '../../components/ui/Spinner';
import { useHomeViewModel } from './Home.viewmodel';
import { S } from './Home.styles';

export const HomeView: React.FC = () => {
  const vm = useHomeViewModel();

  if (vm.isCheckingSession) {
    return (
      <FullPageSpinner>
        <Spinner size={40} />
      </FullPageSpinner>
    );
  }

  return (
    <S.Page>
      <PublicHeader />

      <S.Hero>
        <S.HeroContent>
          <S.Eyebrow>Curatino</S.Eyebrow>
          <S.Title>Um jeito diferente de cuidar da advocacia</S.Title>
          <S.Subtitle>
            Tenha seu próprio escritório sem custo, faça parte de um escritório existente ou convide sua equipe para
            trabalhar junto — tudo em um só sistema.
          </S.Subtitle>
          <S.HeroActions>
            <S.PrimaryButton onClick={vm.goToLogin}>Criar conta grátis</S.PrimaryButton>
            <S.SecondaryButton onClick={vm.goToFeatures}>Ver funcionalidades</S.SecondaryButton>
          </S.HeroActions>
        </S.HeroContent>
        <S.HeroImage>
          <img src={vm.heroImage} alt="Dashboard do Curatino" />
        </S.HeroImage>
      </S.Hero>

      <S.Section>
        <S.SectionTitle>Um sistema, do jeito que o seu escritório precisa</S.SectionTitle>
        <S.ValueGrid>
          {vm.valueProps.map((item) => (
            <S.ValueCard key={item.title}>
              <S.ValueTitle>{item.title}</S.ValueTitle>
              <S.ValueDescription>{item.description}</S.ValueDescription>
            </S.ValueCard>
          ))}
        </S.ValueGrid>
      </S.Section>

      <S.Section>
        <S.SectionTitle>Feito para o dia a dia do escritório</S.SectionTitle>
        <S.HighlightGrid>
          {vm.highlights.map((item) => (
            <S.HighlightCard key={item.title}>
              <S.HighlightImage>
                <img src={item.image} alt={item.title} />
              </S.HighlightImage>
              <S.HighlightTitle>{item.title}</S.HighlightTitle>
              <S.HighlightDescription>{item.description}</S.HighlightDescription>
            </S.HighlightCard>
          ))}
        </S.HighlightGrid>
        <S.SectionLink onClick={vm.goToFeatures}>Ver todas as funcionalidades →</S.SectionLink>
      </S.Section>

      <S.PricingBand>
        <S.PricingBandText>Grátis para 1 usuário. R$ 99,90 por usuário adicional no seu escritório.</S.PricingBandText>
        <S.SecondaryButton onClick={vm.goToPricing}>Ver planos</S.SecondaryButton>
      </S.PricingBand>

      <PublicFooter />
    </S.Page>
  );
};
