import React from 'react';
import {
  RiMagicLine,
  RiUploadLine,
  RiPencilLine,
  RiDownloadLine,
  RiStoreLine,
  RiRefreshLine,
} from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useMarketplaceViewModel } from './Marketplace.viewmodel';
import type { Author } from './Marketplace.viewmodel';
import type { PublicExtensionStatus } from '../../../domain/entities/PublicExtension';
import { S } from './Marketplace.styles';

const AuthorLine: React.FC<{ author: Author; prefix: string }> = ({ author, prefix }) => {
  if (!author.name) return null;
  return (
    <S.Author>
      {author.photoURL
        ? <S.AuthorPhoto src={author.photoURL} alt={author.name} referrerPolicy="no-referrer" />
        : <S.AuthorInitial>{author.name.charAt(0).toUpperCase()}</S.AuthorInitial>}
      {prefix} {author.name}
    </S.Author>
  );
};

const CodeBadge: React.FC = () => <S.Badge $tone="info">Com código</S.Badge>;

const publicStatusBadge = (status: PublicExtensionStatus | null): React.ReactNode => {
  switch (status) {
    case 'pending': return <S.Badge $tone="warning">Em análise</S.Badge>;
    case 'approved': return <S.Badge $tone="success">Publicada</S.Badge>;
    case 'deprecated': return <S.Badge $tone="neutral">Obsoleta</S.Badge>;
    default: return <S.Badge $tone="neutral">Privada</S.Badge>;
  }
};

export const MarketplaceView: React.FC = () => {
  const vm = useMarketplaceViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.HeaderText>
          <S.Title>Extensões</S.Title>
          <S.Subtitle>
            Crie e edite extensões na sua área privada, instale-as para usar no escritório e publique
            no catálogo para compartilhar com outros escritórios.
          </S.Subtitle>
        </S.HeaderText>
        {vm.canManage && (
          <S.HeaderActions>
            <Button variant="secondary" size="sm" onClick={vm.openAuthor}>
              <RiMagicLine size={16} /> Criar extensão
            </Button>
            <S.ImportLabel $disabled={vm.busyId === '__import__'}>
              <RiUploadLine size={16} /> Importar .json
              <S.HiddenFile
                type="file"
                accept="application/json,.json"
                disabled={vm.busyId === '__import__'}
                onChange={(e) => void vm.onImportFile(e)}
              />
            </S.ImportLabel>
          </S.HeaderActions>
        )}
      </S.Header>

      <S.Scroll>
        {!vm.canManage && (
          <InfoBanner
            message="Somente administradores do escritório podem criar, instalar ou publicar extensões."
            variant="info"
          />
        )}

        {vm.canManage && (
          <S.Section>
            <S.SectionHead>
              <S.SectionTitleRow>
                <S.SectionTitle>Minhas Extensões</S.SectionTitle>
                <S.Count>{vm.privateCards.length}</S.Count>
              </S.SectionTitleRow>
              <S.SectionHint>
                Sua área privada de autoria. Edite à vontade; instale para usar aqui no escritório e
                publique quando quiser disponibilizar a outros.
              </S.SectionHint>
            </S.SectionHead>
            {vm.privateCards.length === 0 ? (
              <S.Empty>Você ainda não criou nenhuma extensão. Use "Criar extensão" ou importe um .json.</S.Empty>
            ) : (
              <S.Grid>
                {vm.privateCards.map((ext) => {
                  const busy = vm.busyId === ext.id;
                  return (
                    <S.Card key={ext.id}>
                      <S.CardTop>
                        <S.CardName>{ext.name}</S.CardName>
                        <S.Badges>
                          {ext.hasCode && <CodeBadge />}
                          {publicStatusBadge(ext.publicStatus)}
                        </S.Badges>
                      </S.CardTop>
                      <S.Summary>{ext.summary}</S.Summary>
                      <AuthorLine author={ext.author} prefix="Criada por" />
                      <S.Meta><span>v{ext.version}</span><span>{ext.id}</span></S.Meta>
                      <S.Actions>
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => vm.editPrivate(ext.id)}>
                          <RiPencilLine size={16} /> Editar
                        </Button>
                        <Button variant="primary" size="sm" disabled={busy} onClick={() => vm.installPrivate(ext.id)}>
                          {!ext.installed ? <><RiStoreLine size={16} /> Instalar</> : ext.installOutdated ? <><RiRefreshLine size={16} /> Reinstalar</> : 'Instalada'}
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => vm.publishPrivate(ext.id)}>
                          <RiUploadLine size={16} /> {ext.publicStatus ? 'Republicar' : 'Publicar'}
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => vm.downloadPrivate(ext.id)}>
                          <RiDownloadLine size={16} /> Baixar
                        </Button>
                        <Button variant="danger" size="sm" disabled={busy} onClick={() => vm.requestRemovePrivate(ext.id)}>
                          Excluir
                        </Button>
                      </S.Actions>
                    </S.Card>
                  );
                })}
              </S.Grid>
            )}
          </S.Section>
        )}

        {vm.canManage && (
          <S.Section>
            <S.SectionHead>
              <S.SectionTitleRow>
                <S.SectionTitle>Instaladas</S.SectionTitle>
                <S.Count>{vm.installedCards.length}</S.Count>
              </S.SectionTitleRow>
              <S.SectionHint>
                O que está de fato ativo no escritório — cópias independentes da fonte. Quando a origem
                (sua privada ou a pública) tiver versão mais nova, aparece "Atualizar".
              </S.SectionHint>
            </S.SectionHead>
            {vm.installedCards.length === 0 ? (
              <S.Empty>Nenhuma extensão instalada. Instale a partir de Minhas Extensões ou do catálogo público.</S.Empty>
            ) : (
              <S.Grid>
                {vm.installedCards.map((ext) => {
                  const busy = vm.busyId === ext.id;
                  return (
                    <S.Card key={ext.id}>
                      <S.CardTop>
                        <S.CardName>{ext.name}</S.CardName>
                        <S.Badges>
                          <S.Badge $tone={ext.active ? 'success' : 'neutral'}>{ext.active ? 'Ativa' : 'Inativa'}</S.Badge>
                          {ext.hasCode && <CodeBadge />}
                          {ext.updateAvailable && <S.Badge $tone="primary">Atualização</S.Badge>}
                          {ext.deprecated && <S.Badge $tone="warning">Origem obsoleta</S.Badge>}
                        </S.Badges>
                      </S.CardTop>
                      <S.Summary>{ext.summary}</S.Summary>
                      <AuthorLine author={ext.author} prefix="Por" />
                      <S.Meta><span>v{ext.version}</span><span>{ext.sourceLabel}</span></S.Meta>
                      <S.Actions>
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => vm.toggleInstalledActive(ext.id, !ext.active)}>
                          {ext.active ? 'Desativar' : 'Ativar'}
                        </Button>
                        {ext.updateAvailable && (
                          <Button variant="primary" size="sm" disabled={busy} onClick={() => vm.updateInstalled(ext.id)}>
                            <RiRefreshLine size={16} /> Atualizar{ext.updateVersion ? ` (v${ext.updateVersion})` : ''}
                          </Button>
                        )}
                        {ext.isAuthor && (
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => vm.downloadInstalled(ext.id)}>
                            <RiDownloadLine size={16} /> Baixar
                          </Button>
                        )}
                        <Button variant="danger" size="sm" disabled={busy} onClick={() => vm.uninstallInstalled(ext.id)}>
                          Desinstalar
                        </Button>
                      </S.Actions>
                    </S.Card>
                  );
                })}
              </S.Grid>
            )}
          </S.Section>
        )}

        {vm.canModerate && vm.moderationCards.length > 0 && (
          <S.Section>
            <S.SectionHead>
              <S.SectionTitleRow>
                <S.SectionTitle>Moderação</S.SectionTitle>
                <S.Count>{vm.moderationCards.length}</S.Count>
              </S.SectionTitleRow>
              <S.SectionHint>Extensões com código aguardando aprovação para virarem públicas.</S.SectionHint>
            </S.SectionHead>
            <S.Grid>
              {vm.moderationCards.map((pub) => {
                const busy = vm.busyId === pub.domain;
                return (
                  <S.Card key={pub.domain}>
                    <S.CardTop>
                      <S.CardName>{pub.name}</S.CardName>
                      <S.Badges><S.Badge $tone="warning">Em análise</S.Badge><CodeBadge /></S.Badges>
                    </S.CardTop>
                    <S.Summary>{pub.summary}</S.Summary>
                    <AuthorLine author={pub.author} prefix="Publicada por" />
                    <S.Meta><span>v{pub.version}</span><span>{pub.domain}</span></S.Meta>
                    <S.Actions>
                      <Button variant="primary" size="sm" disabled={busy} onClick={() => vm.approvePublic(pub.domain)}>
                        Aprovar
                      </Button>
                      <Button variant="danger" size="sm" disabled={busy} onClick={() => vm.rejectPublic(pub.domain)}>
                        Recusar
                      </Button>
                    </S.Actions>
                  </S.Card>
                );
              })}
            </S.Grid>
          </S.Section>
        )}

        <S.Section>
          <S.SectionHead>
            <S.SectionTitleRow>
              <S.SectionTitle>Catálogo público</S.SectionTitle>
              <S.Count>{vm.publicCards.length}</S.Count>
            </S.SectionTitleRow>
            <S.SectionHint>Extensões publicadas e aprovadas, disponíveis para todos os escritórios.</S.SectionHint>
          </S.SectionHead>
          {vm.publicCards.length === 0 ? (
            <S.Empty>Ainda não há extensões públicas.</S.Empty>
          ) : (
            <S.Grid>
              {vm.publicCards.map((pub) => {
                const busy = vm.busyId === pub.domain;
                return (
                  <S.Card key={pub.domain}>
                    <S.CardTop>
                      <S.CardName>{pub.name}</S.CardName>
                      <S.Badges>
                        <S.Badge $tone="success">Pública</S.Badge>
                        {pub.hasCode && <CodeBadge />}
                        {pub.isAuthor && <S.Badge $tone="primary">Você é o autor</S.Badge>}
                      </S.Badges>
                    </S.CardTop>
                    <S.Summary>{pub.summary}</S.Summary>
                    <AuthorLine author={pub.author} prefix="Publicada por" />
                    <S.Meta><span>v{pub.version}</span><span>{pub.domain}</span></S.Meta>
                    {vm.canManage && (
                      <S.Actions>
                        {pub.installState === 'installed' ? (
                          <S.Note>Instalada no escritório</S.Note>
                        ) : (
                          <Button variant="primary" size="sm" disabled={busy} onClick={() => vm.installPublic(pub.domain)}>
                            {pub.installState === 'update' ? <><RiRefreshLine size={16} /> Atualizar</> : <><RiStoreLine size={16} /> Instalar</>}
                          </Button>
                        )}
                        {vm.canModerate && (
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => vm.deprecatePublic(pub.domain)}>
                            Marcar obsoleta
                          </Button>
                        )}
                      </S.Actions>
                    )}
                  </S.Card>
                );
              })}
            </S.Grid>
          )}
        </S.Section>
      </S.Scroll>

      <ConfirmModal
        isOpen={vm.removeTarget !== null}
        title="Excluir extensão"
        message={`Excluir "${vm.removeTarget?.name ?? ''}" da sua área privada? Cópias já instaladas (aqui ou em outros escritórios) e a versão publicada não são afetadas.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={vm.confirmRemovePrivate}
        onCancel={vm.cancelRemovePrivate}
      />
    </S.Page>
  );
};
