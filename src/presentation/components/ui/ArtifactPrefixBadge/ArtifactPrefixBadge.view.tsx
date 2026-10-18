import { RiPencilLine, RiPriceTag3Line } from 'react-icons/ri';
import type { PrefixedNameKind } from '../../../../domain/schema/plugin/artifactPrefix';
import { useT } from '../../../shared/i18n/useT';
import { useArtifactPrefixBadgeViewModel } from './ArtifactPrefixBadge.viewmodel';
import { S } from './ArtifactPrefixBadge.styles';

export interface ArtifactPrefixBadgeProps {
  /** O prefixo do escritório; `null` quando ainda não foi definido. */
  prefix: string | null;
  kind: PrefixedNameKind;
}

/**
 * O prefixo do escritório, fixo à frente de um nome que está sendo criado. Para quem pode trocá-lo, um
 * atalho leva direto à seção dele em Configurações — e, sem prefixo definido, o selo vira o convite para
 * defini-lo antes de criar. Sem prefixo e sem a permissão, não aparece.
 */
export const ArtifactPrefixBadge = ({ prefix, kind }: ArtifactPrefixBadgeProps) => {
  const t = useT('core.tenant');
  const vm = useArtifactPrefixBadgeViewModel(prefix, kind);

  if (!vm.head && !vm.canChange) return null;

  return (
    <S.Badge>
      {vm.head && <S.Head $alone={!vm.canChange}>{vm.head}</S.Head>}
      {vm.canChange && (
        <S.Shortcut
          type="button"
          onClick={vm.openPrefixSettings}
          title={t(vm.head ? 'prefix.change' : 'prefix.define')}
          aria-label={t(vm.head ? 'prefix.change' : 'prefix.define')}
        >
          {vm.head ? <RiPencilLine size={13} /> : <><RiPriceTag3Line size={13} />{t('prefix.define.short')}</>}
        </S.Shortcut>
      )}
    </S.Badge>
  );
};
