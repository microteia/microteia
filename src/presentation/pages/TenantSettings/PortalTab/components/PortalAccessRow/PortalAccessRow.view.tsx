import React from 'react';
import { RiCloseLine, RiShieldCheckLine } from 'react-icons/ri';
import { S } from './PortalAccessRow.styles';
import { useT } from '../../../../../shared/i18n/useT';

export interface PortalSubjectChip {
  key: string;
  label: string;
}

interface PortalAccessRowProps {
  name: string;
  /** O selo de identidade verificada — o provedor, ou a claim que o convite exige. */
  verified: string | null;
  /** O aviso de suspensão, já traduzido. */
  suspended?: string | null;
  meta: string | null;
  subjects: PortalSubjectChip[];
  onRemoveSubject: (subjectKey: string) => void;
  actions: React.ReactNode;
}

/** Uma linha das listas da aba Portal: quem, com que identidade, e a que registros tem acesso. */
export const PortalAccessRow: React.FC<PortalAccessRowProps> = ({
  name, verified, suspended, meta, subjects, onRemoveSubject, actions,
}) => {
  const t = useT('core.tenant');

  return (
    <S.Row>
      <S.Info>
        <S.Name>
          {name}
          {verified && <S.Verified><RiShieldCheckLine size={12} />{verified}</S.Verified>}
          {suspended && <S.Suspended>{suspended}</S.Suspended>}
        </S.Name>
        {meta && <S.Meta>{meta}</S.Meta>}
        <S.Subjects>
          {subjects.map((subject) => (
            <S.Subject key={subject.key}>
              {subject.label}
              <S.SubjectRemove type="button" onClick={() => onRemoveSubject(subject.key)} title={t('portal.subject.remove')}>
                <RiCloseLine size={12} />
              </S.SubjectRemove>
            </S.Subject>
          ))}
        </S.Subjects>
      </S.Info>
      <S.Actions>{actions}</S.Actions>
    </S.Row>
  );
};
