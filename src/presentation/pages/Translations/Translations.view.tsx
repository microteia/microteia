import React from 'react';
import { S } from './Translations.styles';
import { useTranslationsViewModel } from './Translations.viewmodel';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { getScreenIcon } from '../../shared/screenIcons';

export const TranslationsView: React.FC = () => {
  const vm = useTranslationsViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.Title>Traduções</S.Title>
        <S.Subtitle>
          Um idioma é uma extensão como qualquer outra. Baixe a extensão de idioma com todos os
          textos do sistema — os do Microteia e os das extensões instaladas —, traduza os textos
          dentro do arquivo e importe de volta.
        </S.Subtitle>
      </S.Header>

      {!vm.canManage && (
        <InfoBanner
          message="Somente administradores do escritório podem instalar idiomas."
          variant="info"
        />
      )}

      <S.Section>
        <S.SectionTitle>1. Baixar a extensão de idioma</S.SectionTitle>
        <S.Hint>
          Informe o idioma no formato <code>pt-BR</code>, <code>es</code> ou <code>de-DE</code>. O
          arquivo vem com os textos preenchidos: a tradução que já existir para esse idioma, ou o
          texto original para você sobrescrever. Traduza os valores dentro de{' '}
          <code>messages</code> e não mexa nas chaves.
        </S.Hint>

        <S.Row>
          <S.Field>
            <S.Label htmlFor="target-locale">Idioma</S.Label>
            <Input
              id="target-locale"
              value={vm.targetLocale}
              placeholder="es"
              onChange={(event) => vm.setTargetLocale(event.target.value)}
            />
          </S.Field>

          <Button onClick={vm.download} disabled={!vm.isTargetValid}>
            Baixar extensão (.json)
          </Button>

          {vm.isTargetValid && (
            <S.Progress>
              {getScreenIcon('globe', 16)}
              {vm.targetLocaleName} — {vm.keyCount} texto(s)
            </S.Progress>
          )}
        </S.Row>
      </S.Section>

      <S.Section>
        <S.SectionTitle>2. Importar de volta</S.SectionTitle>
        <S.Hint>
          Atalho para instalar a extensão de idioma. O mesmo arquivo pode ser importado pela tela de
          Extensões — é o mesmo formato e a mesma instalação.
        </S.Hint>

        <S.Row>
          <Button onClick={vm.pickFile} disabled={!vm.canManage || vm.busy}>
            {vm.busy ? 'Instalando...' : 'Importar extensão de idioma'}
          </Button>
        </S.Row>
      </S.Section>

      <S.Section>
        <S.SectionTitle>Idiomas instalados</S.SectionTitle>
        <S.Hint>
          Para desativar ou remover um idioma, use a tela de Extensões — um idioma é uma extensão.
        </S.Hint>

        {vm.languages.length === 0 ? (
          <S.Empty>Nenhum idioma instalado. O sistema está no idioma original (inglês).</S.Empty>
        ) : (
          <S.InstalledList>
            {vm.languages.map((language) => (
              <S.InstalledItem key={language.id}>
                <S.ItemName>
                  {getScreenIcon('globe', 16)}
                  {language.name}
                  {language.inUse && <Badge>Em uso</Badge>}
                  {language.shadowed && <Badge>Sem efeito</Badge>}
                  {!language.active && <Badge>Desativado</Badge>}
                </S.ItemName>
                <S.ItemMeta>
                  {language.locale} — {language.keyCount} texto(s)
                </S.ItemMeta>
              </S.InstalledItem>
            ))}
          </S.InstalledList>
        )}

        {vm.languages.some((language) => language.shadowed) && (
          <InfoBanner
            message="Há mais de um pacote para o idioma em uso. Só o primeiro vale; os marcados como “Sem efeito” não alteram nada. Remova o que sobra na tela de Extensões."
            variant="warning"
          />
        )}
      </S.Section>
    </S.Page>
  );
};
