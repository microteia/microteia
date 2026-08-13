import React from 'react';
import { RiBracesLine, RiLayoutGridLine } from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { CodeEditor } from '../../components/ui/CodeEditor';
import { Spinner } from '../../components/ui/Spinner';
import { getScreenIcon } from '../../shared/screenIcons';
import { SettingsField } from './SettingsField';
import { useSettingsViewModel } from './Settings.viewmodel';
import { S } from './Settings.styles';

/**
 * A tela única de Configurações — hospedeiro genérico das seções que os plugins declaram. Dois
 * escopos (escritório e usuário) e duas formas de editar (visual e JSON), gravando no mesmo lugar.
 * O kernel não conhece nenhuma configuração em particular: tudo aqui vem de declaração.
 */
export const SettingsView: React.FC = () => {
  const vm = useSettingsViewModel();
  const ActiveEditor = vm.activeEditor;

  if (vm.isLoading && vm.sections.length === 0) {
    return <S.Empty><Spinner size={32} /></S.Empty>;
  }

  const activeSection = vm.sections.find((section) => section.key === vm.activeSectionKey);
  const isReadOnlyScope = vm.scope === 'tenant' && !vm.canEditTenant;

  return (
    <S.Page>
      <S.Header>
        <S.TitleRow>
          <S.Title>Configurações</S.Title>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => vm.setMode(vm.mode === 'visual' ? 'json' : 'visual')}
          >
            {vm.mode === 'visual'
              ? <><RiBracesLine size={14} /> Editar em JSON</>
              : <><RiLayoutGridLine size={14} /> Edição visual</>}
          </Button>
        </S.TitleRow>

        <S.ScopeTabs>
          <S.ScopeTab $active={vm.scope === 'user'} onClick={() => vm.setScope('user')}>
            Usuário
          </S.ScopeTab>
          <S.ScopeTab $active={vm.scope === 'tenant'} onClick={() => vm.setScope('tenant')}>
            Escritório
          </S.ScopeTab>
        </S.ScopeTabs>

        {vm.mode === 'visual' && (
          <S.SearchWrapper>
            <Input
              value={vm.query}
              onChange={(event) => vm.setQuery(event.target.value)}
              placeholder="Buscar configuração"
            />
          </S.SearchWrapper>
        )}
      </S.Header>

      {isReadOnlyScope && (
        <InfoBanner
          message="As configurações do escritório são definidas pelo administrador. Suas preferências pessoais continuam editáveis na aba Usuário."
          variant="info"
        />
      )}

      {vm.mode === 'json' ? (
        <S.Content>
          <S.JsonPane>
            <S.SectionDescription>
              O documento inteiro de {vm.scope === 'tenant' ? 'configurações do escritório' : 'suas preferências'}.
              Chave de uma extensão desativada é preservada; valor fora do que a configuração aceita é recusado.
            </S.SectionDescription>
            <CodeEditor
              language="json"
              value={vm.jsonText}
              onChange={vm.changeJson}
              minHeight="360px"
            />
            {vm.jsonSyntaxError && (
              <InfoBanner message={`JSON inválido: ${vm.jsonSyntaxError}`} variant="warning" />
            )}
            {vm.jsonIssues.length > 0 && (
              <S.JsonIssues>
                {vm.jsonIssues.map((issue) => (
                  <li key={issue.key}>{issue.key}: {issue.message}</li>
                ))}
              </S.JsonIssues>
            )}
            <S.JsonActions>
              <Button size="sm" onClick={vm.saveJson} disabled={!vm.canSaveJson || isReadOnlyScope}>
                Gravar
              </Button>
              <Button size="sm" variant="ghost" onClick={vm.discardJson} disabled={!vm.isJsonDirty}>
                Descartar
              </Button>
            </S.JsonActions>
          </S.JsonPane>
        </S.Content>
      ) : (
        <S.Body>
          <S.Nav>
            {vm.sections.map((section) => (
              <S.NavItem
                key={section.key}
                $active={section.key === vm.activeSectionKey && vm.query.trim() === ''}
                onClick={() => vm.selectSection(section.key)}
              >
                {section.icon && getScreenIcon(section.icon, 16)}
                {section.title}
              </S.NavItem>
            ))}
          </S.Nav>

          <S.Content>
            {vm.sections.length === 0 ? (
              <S.Empty>
                Nenhuma configuração registrada. Extensões que aceitam configuração aparecem aqui.
              </S.Empty>
            ) : (
              <>
                {vm.query.trim() === '' && activeSection && (
                  <div>
                    <S.SectionTitle>{activeSection.title}</S.SectionTitle>
                    {activeSection.description && (
                      <S.SectionDescription>{activeSection.description}</S.SectionDescription>
                    )}
                  </div>
                )}

                {ActiveEditor ? (
                  <ActiveEditor />
                ) : vm.rows.length === 0 ? (
                  <S.Empty>Nenhuma configuração encontrada.</S.Empty>
                ) : (
                  vm.rows.map((row) => (
                    <S.Property key={row.property.key}>
                      <S.PropertyHeader>
                        <S.PropertyLabel>{row.property.label}</S.PropertyLabel>
                        <S.PropertyPath>{row.property.key}</S.PropertyPath>
                        {vm.query.trim() !== '' && <S.Tag>{row.sectionTitle}</S.Tag>}
                        {row.isSetHere && <S.Tag $tone="primary">Modificado</S.Tag>}
                        {row.isOverriddenByUser && <S.Tag>Sobreposto pela sua preferência</S.Tag>}
                        {!row.isSetHere && row.originScope === 'tenant' && vm.scope === 'user' && (
                          <S.Tag>Definido pelo escritório</S.Tag>
                        )}
                        {row.isSetHere && row.isEditable && (
                          <S.ResetButton type="button" onClick={() => vm.resetValue(row.property)}>
                            Restaurar padrão
                          </S.ResetButton>
                        )}
                      </S.PropertyHeader>

                      {row.property.description && (
                        <S.PropertyDescription>{row.property.description}</S.PropertyDescription>
                      )}

                      <S.PropertyControl>
                        <SettingsField
                          property={row.property}
                          value={row.value}
                          disabled={!row.isEditable}
                          onChange={(value) => vm.changeValue(row.property, value)}
                        />
                      </S.PropertyControl>
                    </S.Property>
                  ))
                )}
              </>
            )}
          </S.Content>
        </S.Body>
      )}
    </S.Page>
  );
};
