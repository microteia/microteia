import React from 'react';
import {
  RiDownloadLine, RiCheckLine, RiLockLine, RiAddLine, RiDeleteBinLine, RiErrorWarningLine, RiSaveLine,
} from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { CodeEditor } from '../../components/ui/CodeEditor';
import { getScreenIcon } from '../../shared/screenIcons';
import { CodeViewEditorModal } from './CodeViewEditorModal';
import { usePluginAuthorViewModel, type ArtifactKind } from './PluginAuthor.viewmodel';
import { S } from './PluginAuthor.styles';

const GROUP_ICON: Record<ArtifactKind, string> = {
  screens: 'layoutGrid',
  actions: 'cursor',
  workflows: 'flowChart',
  scripts: 'codeBox',
};

export const PluginAuthorView: React.FC<{ tabKey?: string }> = ({ tabKey }) => {
  const vm = usePluginAuthorViewModel(tabKey);

  return (
    <S.Page>
      <S.Header>
        <S.HeaderLeft>
          <S.Title>{vm.editing ? 'Editar extensão' : 'Criar extensão'}</S.Title>
          <S.Subtitle>Empacote telas, ações, automações e scripts do seu escritório em uma extensão. Salve em Minhas Extensões para editar depois; a publicação fica na tela Extensões.</S.Subtitle>
        </S.HeaderLeft>
        <S.HeaderActions>
          <S.ActionBtn onClick={vm.download} disabled={vm.busy || !vm.canExport} title="Baixar .json">
            <RiDownloadLine size={16} />
          </S.ActionBtn>
          <S.SaveBtn onClick={vm.save} disabled={vm.busy || !vm.canSave} title={vm.busy ? 'Salvando...' : vm.editing ? 'Salvar alterações' : 'Salvar em Minhas Extensões'}>
            <RiSaveLine size={16} />
          </S.SaveBtn>
        </S.HeaderActions>
      </S.Header>

      <S.Content>
        {!vm.canManage && (
          <InfoBanner message="Somente administradores do escritório podem criar extensões." variant="info" />
        )}

        <S.Section>
          <S.SectionTitle>Identificação</S.SectionTitle>
          <S.Card>
            <S.FormGrid>
              <S.Field>
                Identificador
                <S.Input
                  placeholder="com.seuescritorio.vendas"
                  value={vm.form.id}
                  readOnly={vm.editing}
                  onChange={(e) => vm.updateForm({ id: e.target.value })}
                />
                <S.Hint>{vm.editing ? 'O identificador é fixo após a criação.' : 'DNS reverso, ao menos dois segmentos.'}</S.Hint>
              </S.Field>
              <S.Field>
                Nome
                <S.Input placeholder="Vendas" value={vm.form.name} onChange={(e) => vm.updateForm({ name: e.target.value })} />
              </S.Field>
              <S.Field>
                Versão
                <S.Input placeholder="1.0.0" value={vm.form.version} onChange={(e) => vm.updateForm({ version: e.target.value })} />
              </S.Field>
              <S.FieldWide>
                Resumo
                <S.Input placeholder="O que esta extensão adiciona ao escritório." value={vm.form.summary} onChange={(e) => vm.updateForm({ summary: e.target.value })} />
              </S.FieldWide>
              <S.FieldWide>
                Descrição (opcional)
                <S.Textarea value={vm.form.description} onChange={(e) => vm.updateForm({ description: e.target.value })} />
              </S.FieldWide>
            </S.FormGrid>
          </S.Card>
        </S.Section>

        <S.Section>
          <S.SectionTitle>Conteúdo</S.SectionTitle>
          <S.Groups>
            {vm.groups.map((group) => {
              const selectedInGroup = group.options.filter((o) => o.selected).length;
              return (
                <S.Group key={group.kind}>
                  <S.GroupHead>
                    <S.GroupIcon>{getScreenIcon(GROUP_ICON[group.kind], 18)}</S.GroupIcon>
                    <S.GroupTitle>{group.title}</S.GroupTitle>
                    <S.GroupCount>{selectedInGroup}/{group.options.length}</S.GroupCount>
                  </S.GroupHead>
                  <S.GroupBody>
                    {group.options.length === 0 ? (
                      <S.Empty>Nada disponível.</S.Empty>
                    ) : (
                      group.options.map((option) => (
                        <S.Item
                          key={option.id}
                          type="button"
                          $selected={option.selected}
                          disabled={!vm.canManage || option.locked}
                          onClick={() => vm.toggle(group.kind, option.id)}
                          title={
                            option.locked ? 'Necessária por outro item marcado'
                              : option.carried ? 'Embarcada nesta extensão — clique para remover'
                                : undefined
                          }
                        >
                          <S.ItemIcon>{getScreenIcon(option.icon ?? GROUP_ICON[group.kind], 16)}</S.ItemIcon>
                          <S.ItemLabel>{option.label}</S.ItemLabel>
                          {option.locked ? (
                            <S.Required><RiLockLine size={11} /> Obrigatório</S.Required>
                          ) : option.carried ? (
                            <S.Carried><RiCheckLine size={11} /> Incluída</S.Carried>
                          ) : (
                            <S.Check $on={option.selected}>{option.selected && <RiCheckLine size={14} />}</S.Check>
                          )}
                        </S.Item>
                      ))
                    )}
                  </S.GroupBody>
                </S.Group>
              );
            })}
          </S.Groups>
        </S.Section>

        <S.Section>
          <S.CodeHead>
            <S.SectionTitle>Telas de código</S.SectionTitle>
            <Button variant="ghost" size="sm" disabled={!vm.canManage} onClick={vm.addView}>
              <RiAddLine size={16} /> Adicionar tela
            </Button>
          </S.CodeHead>
          {vm.codeViews.length === 0 ? (
            <S.CodeEmpty>
              Nenhuma tela de código. Adicione uma para entregar uma tela interativa própria — escrita em
              código e renderizada com segurança. Roda em outro escritório só depois de publicada no catálogo.
            </S.CodeEmpty>
          ) : (
            <S.ViewGrid>
              {vm.codeViews.map((view) => (
                <S.ViewChip
                  key={view.id}
                  type="button"
                  onClick={() => vm.openView(view.id)}
                >
                  <S.ItemIcon>{getScreenIcon(view.icon, 16)}</S.ItemIcon>
                  <S.ItemLabel>{view.title}</S.ItemLabel>
                  {view.hasError && <S.ViewWarn title="Não compila"><RiErrorWarningLine size={14} /></S.ViewWarn>}
                  <S.ViewRemove
                    role="button"
                    aria-label="Remover tela"
                    title="Remover tela"
                    onClick={(e) => { e.stopPropagation(); vm.removeView(view.id); }}
                  >
                    <RiDeleteBinLine size={14} />
                  </S.ViewRemove>
                </S.ViewChip>
              ))}
            </S.ViewGrid>
          )}
        </S.Section>

        <S.Section>
          <S.SectionTitle>Código de inicialização</S.SectionTitle>
          <S.Hint>
            Opcional. Roda uma vez quando a extensão é carregada no escritório e recebe um <code>host</code> para
            registrar serviços — como comandos do ⌘K e menções <code>@</code>. Exporte como <code>default</code> uma
            função <code>(host) =&gt; cleanup?</code>.
          </S.Hint>
          {vm.startupError && <InfoBanner message={`Não compila: ${vm.startupError}`} variant="warning" />}
          <S.Card>
            <CodeEditor value={vm.startup} onChange={vm.setStartup} minHeight="300px" extraLib={vm.extensionTypeDefs} />
          </S.Card>
        </S.Section>

        {vm.issues.length > 0 && vm.selectedCount > 0 && (
          <S.Section>
            <S.SectionTitle>Pendências</S.SectionTitle>
            <S.Issues>
              {vm.issues.map((issue) => (
                <S.Issue key={issue}>{issue}</S.Issue>
              ))}
            </S.Issues>
          </S.Section>
        )}

        <S.StatusBar>
          <S.Count>{vm.selectedCount} {vm.selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}</S.Count>
        </S.StatusBar>
      </S.Content>

      <CodeViewEditorModal
        isOpen={vm.editorOpen}
        view={vm.selectedView}
        iconOptions={vm.iconOptions}
        onChange={vm.updateSelectedView}
        onClose={vm.closeEditor}
        extensionTypeDefs={vm.extensionTypeDefs}
      />
    </S.Page>
  );
};
