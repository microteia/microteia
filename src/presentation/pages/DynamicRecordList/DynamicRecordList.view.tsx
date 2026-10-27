import React from 'react';
import { S } from './DynamicRecordList.styles';
import { useDynamicRecordListViewModel } from './DynamicRecordList.viewmodel';
import { Spinner } from '../../components/ui/Spinner';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { RecordListSurface } from '../../components/layout/RecordListSurface';
import { RecordImportDialog } from '../../components/ui/RecordImportDialog';
import { Button } from '../../components/ui/Button';
import { RiUploadLine } from 'react-icons/ri';

import { useT } from '../../shared/i18n/useT';

/**
 * A moldura de quando não há lista para mostrar. Duas razões chegam aqui, e elas não dizem a mesma
 * coisa: a tela não está mais lá, ou está e não é desta pessoa. Uma manda perguntar o que houve, a
 * outra manda pedir acesso — e é por isso que a mensagem entra por fora, já resolvida.
 */
const ScreenNotice: React.FC<{ message: string; isLoading?: boolean }> = ({ message, isLoading }) => {
  const t = useT('core.records');
  return (
    <S.Page>
      <S.Header>
        <S.Title>{t('screen.custom')}</S.Title>
      </S.Header>
      <S.BannerWrapper>
        {isLoading ? (
          <S.SpinnerWrapper><Spinner /></S.SpinnerWrapper>
        ) : (
          <InfoBanner variant="info" message={message} />
        )}
      </S.BannerWrapper>
    </S.Page>
  );
};

export const DynamicRecordListView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const t = useT('core.records');
  const vm = useDynamicRecordListViewModel(tabKey);
  const definition = vm.definition;

  if (!vm.isAvailable || !definition) {
    return <ScreenNotice message={t('screen.unavailable')} isLoading={vm.isLoading} />;
  }

  // O menu já não oferece esta tela a quem não pode ler a coleção dela, mas a aba salva de ontem e o
  // link colado ainda chegam aqui. Sem isto, o que a pessoa vê é a lista que o servidor deixou vazia:
  // a tela promete registros e não explica por que não há nenhum.
  if (!vm.canRead) {
    return <ScreenNotice message={t('screen.no-read-permission')} />;
  }

  return (
    <>
      <RecordListSurface
        vm={vm}
        definition={definition}
        variant="page"
        headerActions={vm.canImport
          ? (
            <Button variant="secondary" size="sm" onClick={vm.openImport} title={t('import.open')}>
              <RiUploadLine size={14} />
              {t('import.open')}
            </Button>
          )
          : undefined}
        summary={vm.notices.length > 0
          ? (
            <S.Notices>
              {vm.notices.map((notice) => (
                <InfoBanner key={notice.message} variant={notice.variant} message={notice.message} />
              ))}
            </S.Notices>
          )
          : undefined}
      />
      {vm.importOpen && (
        <RecordImportDialog collection={vm.collection} screenTitle={vm.screenTitle} onClose={vm.closeImport} />
      )}
    </>
  );
};
