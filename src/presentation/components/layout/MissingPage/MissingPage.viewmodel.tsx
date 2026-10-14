import { useMemo } from 'react';
import { useContributions, useKernel } from '../../../../stores/useKernel';
import { UI_MENU_POINT, UI_NAV_POINT } from '../../../../domain/schema/ui/uiExtensionPoints';
import { navTargetOf } from '../../../../domain/usecases/plugins/navTargets';
import { useLabel, useT } from '../../../shared/i18n/useT';

export interface MissingPageProps {
  tabKey: string;
}

export interface MissingPageViewModel {
  title: string;
  detail: string;
}

/**
 * A aba que nenhum `ui.page` desenha. Antes ela era um painel em branco: sem erro, sem a chave e sem o
 * nome de quem pôs o item no menu — e quem a via não tinha por onde começar.
 *
 * A extensão culpada é a dona do item de menu (`ui.nav` ou `ui.menu`) que escreve esta chave. Uma aba
 * aberta por outro caminho — um link, uma aba restaurada de outra sessão — não tem dono a nomear, e a
 * frase diz só a chave.
 */
export const useMissingPageViewModel = ({ tabKey }: MissingPageProps): MissingPageViewModel => {
  const t = useT('core.ui');
  const label = useLabel();
  const { host } = useKernel();
  const navContributions = useContributions(UI_NAV_POINT);
  const menuContributions = useContributions(UI_MENU_POINT);

  const extension = useMemo(() => {
    const owner = [...navContributions, ...menuContributions]
      .find((contribution) => navTargetOf(contribution)?.key === tabKey);
    if (!owner) return null;
    const name = host.manifestOf(owner.pluginId)?.name;
    return name ? label(name) : owner.pluginId;
  }, [navContributions, menuContributions, tabKey, host, label]);

  return {
    title: t('workspace.missing-page.title'),
    detail: extension === null
      ? t('workspace.missing-page', { key: tabKey })
      : t('workspace.missing-page.from', { key: tabKey, extension }),
  };
};
