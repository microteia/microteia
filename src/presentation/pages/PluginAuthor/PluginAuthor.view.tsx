import React from 'react';
import {
  RiDownloadLine, RiCheckLine, RiLockLine, RiAddLine, RiDeleteBinLine, RiErrorWarningLine, RiSaveLine,
  RiArrowRightSLine, RiArrowDownSLine, RiCodeSSlashLine,
} from 'react-icons/ri';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { CodeEditor } from '../../components/ui/CodeEditor';
import { Modal } from '../../components/ui/Modal';
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
          <S.TreeContainer>
            {/* Item fixo: Código de inicialização */}
            <S.TreeItem
              type="button"
              onClick={vm.openStartupEditor}
              title="Editar código de inicialização"
            >
              <S.TreeItemIcon><RiCodeSSlashLine size={16} /></S.TreeItemIcon>
              <S.TreeItemLabel>Código de inicialização</S.TreeItemLabel>
              {vm.startupError && <S.ViewWarn title="Não compila"><RiErrorWarningLine size={14} /></S.ViewWarn>}
            </S.TreeItem>

            {vm.groups.map((group) => {
              const selectedInGroup = group.options.filter((o) => o.selected).length;
              const isExpanded = vm.expandedGroups.has(group.kind);
              return (
                <S.TreeGroup key={group.kind}>
                  <S.TreeGroupHead
                    onClick={() => vm.toggleGroup(group.kind)}
                    title={isExpanded ? 'Colapsar grupo' : 'Expandir grupo'}
                  >
                    <S.TreeToggle>
                      {isExpanded ? <RiArrowDownSLine size={16} /> : <RiArrowRightSLine size={16} />}
                    </S.TreeToggle>
                    <S.TreeGroupIcon>{getScreenIcon(GROUP_ICON[group.kind], 16)}</S.TreeGroupIcon>
                    <S.TreeGroupLabel>{group.title}</S.TreeGroupLabel>
                    <S.TreeGroupCount>{selectedInGroup}/{group.options.length}</S.TreeGroupCount>
                  </S.TreeGroupHead>
                  {isExpanded && (
                    <>
                      {group.options.length === 0 ? (
                        <S.TreeEmpty>Nada disponível.</S.TreeEmpty>
                      ) : (
                        group.options.map((option) => (
                          <S.TreeItem
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
                            <S.TreeItemIcon>{getScreenIcon(option.icon ?? GROUP_ICON[group.kind], 16)}</S.TreeItemIcon>
                            <S.TreeItemLabel>{option.label}</S.TreeItemLabel>
                            {option.locked ? (
                              <S.Required><RiLockLine size={11} /> Obrigatório</S.Required>
                            ) : option.carried ? (
                              <S.Carried><RiCheckLine size={11} /> Incluída</S.Carried>
                            ) : (
                              <S.Check $on={option.selected}>{option.selected && <RiCheckLine size={14} />}</S.Check>
                            )}
                          </S.TreeItem>
                        ))
                      )}
                    </>
                  )}
                </S.TreeGroup>
              );
            })}

            <S.TreeGroup>
              <S.TreeGroupHead
                onClick={() => vm.toggleGroup('codeViews')}
                title={vm.expandedGroups.has('codeViews') ? 'Colapsar grupo' : 'Expandir grupo'}
              >
                <S.TreeToggle>
                  {vm.expandedGroups.has('codeViews') ? <RiArrowDownSLine size={16} /> : <RiArrowRightSLine size={16} />}
                </S.TreeToggle>
                <S.TreeGroupIcon>{getScreenIcon('codeBox', 16)}</S.TreeGroupIcon>
                <S.TreeGroupLabel>Telas de código</S.TreeGroupLabel>
                <S.TreeGroupCount>{vm.codeViews.length}</S.TreeGroupCount>
                <S.TreeGroupAction
                  onClick={(e) => {
                    e.stopPropagation();
                    vm.addView();
                  }}
                  disabled={!vm.canManage}
                  title="Adicionar tela"
                >
                  <RiAddLine size={14} />
                </S.TreeGroupAction>
              </S.TreeGroupHead>
              {vm.expandedGroups.has('codeViews') && (
                <>
                  {vm.codeViews.length === 0 ? (
                    <S.TreeEmpty>Nenhuma tela de código.</S.TreeEmpty>
                  ) : (
                    vm.codeViews.map((view) => (
                      <S.TreeItem
                        key={view.id}
                        type="button"
                        onClick={() => vm.openView(view.id)}
                      >
                        <S.TreeItemIcon>{getScreenIcon(view.icon, 16)}</S.TreeItemIcon>
                        <S.TreeItemLabel>{view.title}</S.TreeItemLabel>
                        {view.hasError && <S.ViewWarn title="Não compila"><RiErrorWarningLine size={14} /></S.ViewWarn>}
                        <S.TreeItemAction
                          role="button"
                          aria-label="Remover tela"
                          title="Remover tela"
                          onClick={(e) => { e.stopPropagation(); vm.removeView(view.id); }}
                        >
                          <RiDeleteBinLine size={14} />
                        </S.TreeItemAction>
                      </S.TreeItem>
                    ))
                  )}
                </>
              )}
            </S.TreeGroup>
          </S.TreeContainer>
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

      {/* Modal de edição do código de inicialização */}
      {vm.startupEditorOpen && (
        <Modal 
          title="Código de inicialização" 
          onClose={vm.closeStartupEditor} 
          size="xlarge"
          maximizable
          maximized={vm.startupMaximized}
          onToggleMaximize={vm.toggleStartupMaximized}
        >
          <S.StartupDescription>
            Opcional. Roda uma vez quando a extensão é carregada no escritório e recebe um <code>host</code> para
            registrar serviços — como comandos do ⌘K e menções <code>@</code>. Exporte como <code>default</code> uma
            função <code>(host) =&gt; cleanup?</code>.
          </S.StartupDescription>
          {vm.startupError && <InfoBanner message={`Não compila: ${vm.startupError}`} variant="warning" />}
          <S.EditorContainer>
            <CodeEditor 
              value={vm.startup} 
              onChange={vm.setStartup} 
              minHeight={vm.startupMaximized ? "calc(100vh - 240px)" : "calc(85vh - 200px)"} 
              extraLib={vm.extensionTypeDefs} 
            />
          </S.EditorContainer>
        </Modal>
      )}

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
