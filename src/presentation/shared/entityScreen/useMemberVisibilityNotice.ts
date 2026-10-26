import { useMemo } from 'react';
import type { ScreenDefinition } from '../../../domain/entities';
import { screenDataCollection } from '../../../domain/services/screenDataCollection';
import { readerSeesAll, readMemberVisibility } from '../../../domain/schema/memberVisibility';
import { useAuthorization } from '../../../stores/useAuthorization';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useT } from '../i18n/useT';

export interface MemberVisibilityNoticeView {
  message: string;
  variant: 'info';
}

/**
 * O aviso de que a lista mostra só o que NOMEIA quem a vê (`memberVisibility`). Sem ele, a pessoa veria
 * menos registros que o colega ao lado e concluiria que faltam dados — é a lista vazia sem explicação,
 * por outra porta. A declaração é a do documento da COLEÇÃO, o que a regra lê; quem supervisiona não
 * recebe aviso nenhum, porque vê tudo.
 */
export const useMemberVisibilityNotice = (definition: ScreenDefinition | null): MemberVisibilityNoticeView | null => {
  const { getDefinition } = useScreenDefinitions();
  const { effectivePermissions } = useAuthorization();
  const t = useT('core.records');

  return useMemo(() => {
    if (!definition) return null;
    const collection = screenDataCollection(definition);
    const spec = readMemberVisibility(getDefinition(collection)?.memberVisibility);
    if (!spec || readerSeesAll(spec, collection, effectivePermissions)) return null;
    return { message: t('member-visibility.list.restricted'), variant: 'info' };
  }, [definition, getDefinition, effectivePermissions, t]);
};
