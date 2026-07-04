import React from 'react';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { PublicFooter } from '../../components/layout/PublicFooter';
import { usePricingViewModel } from './Pricing.viewmodel';
import { S } from './Pricing.styles';

export const PricingView: React.FC = () => {
  const vm = usePricingViewModel();

  return (
    <S.Page>
      <PublicHeader />

      <S.Intro>
        <S.Title>Preços simples, sem surpresa</S.Title>
        <S.Subtitle>Comece sozinho de graça e pague só quando convidar mais gente para o escritório.</S.Subtitle>
      </S.Intro>

      <S.PlanGrid>
        {vm.plans.map((plan) => (
          <S.PlanCard key={plan.name} $highlighted={plan.highlighted}>
            <S.PlanName>{plan.name}</S.PlanName>
            <S.PlanPrice>
              <S.PlanPriceValue>{plan.price}</S.PlanPriceValue>
              <S.PlanPriceDetail>{plan.priceDetail}</S.PlanPriceDetail>
            </S.PlanPrice>
            <S.PlanDescription>{plan.description}</S.PlanDescription>
            <S.PlanFeatureList>
              {plan.features.map((feature) => (
                <S.PlanFeatureItem key={feature}>{feature}</S.PlanFeatureItem>
              ))}
            </S.PlanFeatureList>
            <S.PlanButton $highlighted={plan.highlighted} onClick={vm.goToLogin}>
              Começar agora
            </S.PlanButton>
          </S.PlanCard>
        ))}
      </S.PlanGrid>

      <PublicFooter />
    </S.Page>
  );
};
