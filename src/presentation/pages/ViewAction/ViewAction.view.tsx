import React from 'react';
import { RiCursorLine, RiSave3Line, RiDeleteBinLine } from 'react-icons/ri';
import { S } from './ViewAction.styles';
import { useViewActionViewModel } from './ViewAction.viewmodel';
import { Input, Label, Textarea } from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Checkbox';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { ExpressionEditor } from '../../components/ui/ExpressionEditor';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { InfoBanner } from '../../components/ui/InfoBanner';

export const ViewActionView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewActionViewModel(tabKey);

  if (!vm.isAdmin) {
    return (
      <S.Page>
        <S.Header>
          <S.HeaderTitle><RiCursorLine size={20} />Ação</S.HeaderTitle>
        </S.Header>
        <S.Content>
          <InfoBanner variant="info" message="Somente administradores do escritório podem configurar ações." />
        </S.Content>
      </S.Page>
    );
  }

  if (vm.notFound) {
    return (
      <S.Page>
        <S.Header>
          <S.HeaderTitle><RiCursorLine size={20} />Ação</S.HeaderTitle>
        </S.Header>
        <S.Content>
          <InfoBanner message="Esta ação não existe mais ou foi excluída." />
        </S.Content>
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.HeaderTitle>
          <RiCursorLine size={20} />
          {vm.isNew ? 'Nova Ação' : (vm.formData.title || 'Ação')}
        </S.HeaderTitle>
        <S.HeaderActions>
          <S.SaveBtn
            onClick={() => void vm.handleSave()}
            disabled={!vm.canSave}
            title={vm.isSaving ? 'Salvando...' : 'Salvar'}
          >
            <RiSave3Line size={14} />
          </S.SaveBtn>
          {!vm.isNew && (
            <S.DeleteBtn onClick={vm.handleDelete} title="Excluir ação">
              <RiDeleteBinLine size={14} />
            </S.DeleteBtn>
          )}
        </S.HeaderActions>
      </S.Header>

      <S.Content>
        <S.Section>
          <S.SectionTitle>Geral</S.SectionTitle>
          <S.SectionBody>
            <S.Field>
              <Label>Identificador *</Label>
              <Input
                value={vm.formData.key}
                onChange={(e) => vm.setFormData({ key: e.target.value })}
                placeholder="ex: send_email"
              />
              <S.SectionHint>
                Chega ao fluxo de trabalho no parâmetro <code>action</code>, para que um mesmo fluxo
                atenda mais de uma ação.
              </S.SectionHint>
            </S.Field>
            <S.Field>
              <Label>Título *</Label>
              <Input
                value={vm.formData.title}
                onChange={(e) => vm.setFormData({ title: e.target.value })}
                placeholder="ex: Enviar por e-mail"
              />
            </S.Field>
            <S.Field>
              <Label>Ícone</Label>
              <SearchSelect
                options={vm.iconOptions}
                value={vm.formData.icon}
                onChange={(icon) => vm.setFormData({ icon })}
                placeholder="Escolha um ícone"
              />
            </S.Field>
            <S.Field>
              <Label>Fluxo de trabalho *</Label>
              <SearchSelect
                options={vm.workflowOptions}
                value={vm.formData.workflowId}
                onChange={(workflowId) => vm.setFormData({ workflowId })}
                placeholder="Escolha o fluxo a executar"
              />
              <S.SectionHint>
                Apenas fluxos do tipo "Workflow chamado" aparecem aqui. Ele recebe os parâmetros
                <code> action</code>, <code>source</code> e <code>context</code>.
                O <strong>último</strong> Step precisa devolver <code>result</code>,{' '}
                <code>status</code> e <code>actions</code> de uma vez — use "Montar Objeto" sem
                nome, ou um Step Script. Três Steps de "Saída do Workflow" não funcionam: só o
                último seria considerado. O status aceita{' '}
                <code>["SUCCESS", "Mensagem"]</code> ou apenas <code>"SUCCESS"</code>; para
                devolver erros por campo, use <code>object("code", …, "fieldErrors", …)</code>.
              </S.SectionHint>
            </S.Field>
            <S.Field>
              <Checkbox
                label="Ativa"
                checked={vm.formData.enabled}
                onChange={() => vm.setFormData({ enabled: !vm.formData.enabled })}
              />
              <Checkbox
                label="Ação destrutiva (destaque em vermelho)"
                checked={vm.formData.danger}
                onChange={() => vm.setFormData({ danger: !vm.formData.danger })}
              />
            </S.Field>
          </S.SectionBody>
        </S.Section>

        <S.Section>
          <S.SectionTitle>Comportamento por expressão</S.SectionTitle>
          <S.SectionBody>
            <S.SectionHint>
              Reavaliadas ao abrir a tela e a cada alteração de campo. Além dos campos da tela, use
              <code> record</code>, <code>isNew</code>, <code>isDirty</code> e <code>role</code>.
            </S.SectionHint>
            <S.Field>
              <Label>Ocultar quando</Label>
              <ExpressionEditor
                value={vm.formData.hiddenWhen}
                onChange={(hiddenWhen) => vm.setFormData({ hiddenWhen })}
                placeholder='ex: isNew or role != "admin"'
                workflowVariables={vm.expressionVariables}
              />
            </S.Field>
            <S.Field>
              <Label>Desabilitar quando</Label>
              <ExpressionEditor
                value={vm.formData.disabledWhen}
                onChange={(disabledWhen) => vm.setFormData({ disabledWhen })}
                placeholder="ex: isEmpty(email)"
                workflowVariables={vm.expressionVariables}
              />
            </S.Field>
          </S.SectionBody>
        </S.Section>

        <S.Section>
          <S.SectionTitle>Confirmação</S.SectionTitle>
          <S.SectionBody>
            <S.Field>
              <Label>Mensagem de confirmação</Label>
              <Textarea
                value={vm.formData.confirmMessage}
                onChange={(e) => vm.setFormData({ confirmMessage: e.target.value })}
                placeholder="Deixe em branco para executar sem confirmar."
                rows={2}
              />
            </S.Field>
          </S.SectionBody>
        </S.Section>
      </S.Content>

      <ConfirmModal
        isOpen={!!vm.actionToDelete}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
        title="Excluir Ação"
        message={`Tem certeza que deseja excluir a ação "${vm.actionToDelete?.title ?? ''}"? As telas que a exibem deixarão de mostrá-la.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </S.Page>
  );
};
