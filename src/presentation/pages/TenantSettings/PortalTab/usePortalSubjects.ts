import { useCallback, useMemo } from 'react';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { useReferenceOptions, type ReferenceOption } from '../../../hooks/useReferenceOptions';
import { screenDataCollection } from '../../../../domain/services/screenDataCollection';
import { parsePortalSubjectKey } from '../../../../domain/schema/portal';
import { portalSubjectRoleOf, type PortalSubjectRole } from '../../../../domain/schema/portalRole';
import { useLabel, useT } from '../../../shared/i18n/useT';

export interface PortalSubjects {
  /** As opções de registro de uma coleção-sujeito, rotuladas como no seletor de relação. */
  recordOptionsOf: (collection: string) => ReferenceOption[];
  /** "Tela: título do registro", com o papel quando há um. */
  describe: (subjectKey: string, roles: PortalSubjectRole[]) => string;
}

/**
 * O nome de um registro-sujeito sai do MESMO resolvedor das relações (`useReferenceOptions`): um
 * campo-título que é ele mesmo uma relação guarda o id do registro apontado, e a aba mostrava esse id
 * — "Domicílio eletrônico: O2aJFann4uLX…" no lugar do nome do contribuinte.
 */
export const usePortalSubjects = (): PortalSubjects => {
  const t = useT('core.tenant');
  const label = useLabel();
  const { definitions } = useScreenDefinitions();
  const referenceOptions = useReferenceOptions();

  const titles = useMemo(() => {
    const index = new Map<string, Map<string, string>>();
    Object.entries(referenceOptions).forEach(([collection, options]) => {
      index.set(collection, new Map(options.map((option) => [option.value, option.label])));
    });
    return index;
  }, [referenceOptions]);

  const recordOptionsOf = useCallback(
    (collection: string) => referenceOptions[collection] ?? [],
    [referenceOptions],
  );

  const subjectLabel = useCallback((subjectKey: string): string => {
    const parsed = parsePortalSubjectKey(subjectKey);
    if (!parsed) return subjectKey;
    const owner = definitions.find((one) => screenDataCollection(one) === parsed.collection);
    const title = titles.get(parsed.collection)?.get(parsed.recordId) ?? parsed.recordId;
    return owner ? `${label(owner.titleSingular)}: ${title}` : title;
  }, [definitions, titles, label]);

  const describe = useCallback((subjectKey: string, roles: PortalSubjectRole[]): string => {
    const role = portalSubjectRoleOf(roles, subjectKey);
    return role ? t('portal.subject.role', { subject: subjectLabel(subjectKey), role }) : subjectLabel(subjectKey);
  }, [subjectLabel, t]);

  return useMemo(() => ({ recordOptionsOf, describe }), [recordOptionsOf, describe]);
};
