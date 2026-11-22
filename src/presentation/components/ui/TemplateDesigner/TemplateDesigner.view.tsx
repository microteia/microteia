import React from 'react';
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiDeleteBinLine,
  RiErrorWarningLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiLayoutMasonryLine,
} from 'react-icons/ri';
import { S } from './TemplateDesigner.styles';
import { useTemplateDesignerViewModel } from './TemplateDesigner.viewmodel';
import type {
  DesignerCanvasNode,
  DesignerProperty,
  DesignerSlot,
  TemplateDesignerProps,
  TemplateDesignerViewModel,
} from './TemplateDesigner.viewmodel';
import { Checkbox } from '../Checkbox';
import { InfoBanner } from '../InfoBanner';
import { Input } from '../Input';
import { LabelInput } from '../LabelInput';
import { MultiSearchSelect } from '../MultiSearchSelect';
import { SearchSelect } from '../SearchSelect';
import { useT } from '../../../shared/i18n/useT';

interface NodeListProps {
  nodes: DesignerCanvasNode[];
  slots: DesignerSlot[];
  direction: 'row' | 'column';
  vm: TemplateDesignerViewModel;
}

const Slot: React.FC<{ slot: DesignerSlot; direction: 'row' | 'column'; vm: TemplateDesignerViewModel }> = ({ slot, direction, vm }) => (
  <S.Slot
    $direction={direction}
    $dragging={vm.dragging}
    $allowed={slot.allowed}
    $active={slot.active}
    data-testid={`designer-slot-${slot.id}`}
    onDragOver={(event) => vm.dragOverSlot(slot.id, event)}
  />
);

const NodeList: React.FC<NodeListProps> = ({ nodes, slots, direction, vm }) => (
  <S.NodeList $direction={direction}>
    {slots[0] && <Slot slot={slots[0]} direction={direction} vm={vm} />}
    {nodes.map((node, index) => (
      <React.Fragment key={node.key}>
        <CanvasNode node={node} vm={vm} />
        {slots[index + 1] && <Slot slot={slots[index + 1]} direction={direction} vm={vm} />}
      </React.Fragment>
    ))}
  </S.NodeList>
);

const Markers: React.FC<{ node: DesignerCanvasNode }> = ({ node }) => {
  const t = useT('core.records');
  return (
    <>
      {node.hidden && <S.Marker $tone="muted" title={t('template-designer.marker.hidden')}><RiEyeOffLine size={12} /></S.Marker>}
      {node.invalid && <S.Marker $tone="danger" title={t('template-designer.marker.invalid')}><RiErrorWarningLine size={12} /></S.Marker>}
    </>
  );
};

const CanvasNode: React.FC<{ node: DesignerCanvasNode; vm: TemplateDesignerViewModel }> = ({ node, vm }) => {
  const t = useT('core.records');
  if (node.container) {
    return (
      <S.Container
        data-designer-node={node.key}
        data-testid={`designer-node-${node.key}`}
        role="button"
        aria-pressed={node.selected}
        draggable
        $direction={node.container}
        $selected={node.selected}
        $invalid={node.invalid}
        $dragging={node.dragging}
        onClick={(event) => vm.select(node.key, event)}
        onDragStart={(event) => vm.startNodeDrag(node.key, event)}
        onDragOver={(event) => vm.dragOverNode(node.key, event)}
        onDragEnd={vm.endDrag}
      >
        <S.ContainerHeader data-designer-edge>
          <node.icon size={12} />
          <span>{node.label}</span>
          <Markers node={node} />
        </S.ContainerHeader>
        {node.children.length === 0 && <S.EmptyContainer>{t('template-designer.container.empty')}</S.EmptyContainer>}
        <NodeList nodes={node.children} slots={node.slots} direction={node.container} vm={vm} />
      </S.Container>
    );
  }
  return (
    <S.Chip
      data-designer-node={node.key}
      data-testid={`designer-node-${node.key}`}
      role="button"
      aria-pressed={node.selected}
      draggable
      $selected={node.selected}
      $invalid={node.invalid}
      $dragging={node.dragging}
      onClick={(event) => vm.select(node.key, event)}
      onDragStart={(event) => vm.startNodeDrag(node.key, event)}
      onDragOver={(event) => vm.dragOverNode(node.key, event)}
      onDragEnd={vm.endDrag}
    >
      <node.icon size={14} />
      <S.ChipLabel>{node.label}</S.ChipLabel>
      {node.caption && <S.ChipCaption>{node.caption}</S.ChipCaption>}
      <Markers node={node} />
    </S.Chip>
  );
};

const PropertyEditor: React.FC<{ property: DesignerProperty; vm: TemplateDesignerViewModel }> = ({ property, vm }) => {
  const t = useT('core.records');
  const errors = property.errors.map((error) => <S.PropertyError key={error}>{error}</S.PropertyError>);
  switch (property.kind) {
    case 'boolean':
      return (
        <S.Property>
          <Checkbox label={property.label} checked={property.checked} onChange={(checked) => vm.setProperty(property.key, checked)} />
          {errors}
        </S.Property>
      );
    case 'enum':
      return (
        <S.Property>
          <S.PropertyLabel>{property.label}</S.PropertyLabel>
          <S.Segmented role="group" aria-label={property.label}>
            {property.choices.map((choice) => (
              <S.Segment
                key={choice.value}
                type="button"
                $active={choice.active}
                aria-pressed={choice.active}
                onClick={() => vm.setEnum(property.key, choice.value)}
              >
                {choice.label}
              </S.Segment>
            ))}
          </S.Segmented>
          {errors}
        </S.Property>
      );
    case 'field':
    case 'icon':
      return (
        <S.Property>
          <S.PropertyLabel>{property.label}</S.PropertyLabel>
          <SearchSelect
            options={property.options}
            value={property.value}
            onChange={(value) => vm.setProperty(property.key, value)}
            placeholder={t(property.kind === 'field' ? 'template-designer.field.placeholder' : 'template-designer.icon.placeholder')}
          />
          {errors}
        </S.Property>
      );
    case 'text':
      return (
        <S.Property>
          <S.PropertyLabel>{property.label}</S.PropertyLabel>
          <LabelInput
            value={property.value}
            onChange={(value) => vm.setProperty(property.key, value)}
            placeholder={t('template-designer.text.placeholder')}
            hasError={property.errors.length > 0}
          />
          {errors}
        </S.Property>
      );
    case 'expression':
      return (
        <S.Property>
          <S.PropertyLabel>{property.label}</S.PropertyLabel>
          <Input
            value={property.value}
            onChange={(event) => vm.setProperty(property.key, event.target.value)}
            placeholder={t('template-designer.expression.placeholder')}
            $hasError={property.errors.length > 0}
            spellCheck={false}
          />
          <S.Hint>{t('template-designer.expression.hint')}</S.Hint>
          {errors}
        </S.Property>
      );
    case 'fieldLabel':
      return (
        <S.Property>
          <S.PropertyLabel>{property.label}</S.PropertyLabel>
          <S.Segmented role="group" aria-label={property.label}>
            {property.choices.map((choice) => (
              <S.Segment
                key={choice.value}
                type="button"
                $active={choice.active}
                aria-pressed={choice.active}
                onClick={() => vm.setFieldLabelMode(property.key, choice.value)}
              >
                {choice.label}
              </S.Segment>
            ))}
          </S.Segmented>
          {property.custom && (
            <LabelInput
              value={property.text}
              onChange={(value) => vm.setFieldLabelText(property.key, value)}
              placeholder={t('template-designer.text.placeholder')}
              hasError={property.errors.length > 0}
            />
          )}
          {errors}
        </S.Property>
      );
    case 'actionKeys':
      return (
        <S.Property>
          <S.PropertyLabel>{property.label}</S.PropertyLabel>
          <MultiSearchSelect
            options={property.options}
            values={property.values}
            onChange={(values) => vm.setProperty(property.key, values)}
            placeholder={t('template-designer.actions.placeholder')}
          />
          {errors}
        </S.Property>
      );
    default:
      return null;
  }
};

const Inspector: React.FC<{ vm: TemplateDesignerViewModel }> = ({ vm }) => {
  const t = useT('core.records');
  const { inspector } = vm;
  return (
    <S.Side $active={vm.sideTab === 'properties'} $area="inspector" data-testid="designer-inspector">
      <S.SideTitle>{t('template-designer.tab.properties')}</S.SideTitle>
      <S.InspectorHeader>
        {inspector.icon && <inspector.icon size={16} />}
        <span>{inspector.title}</span>
      </S.InspectorHeader>
      {inspector.isRoot && <S.Hint>{t('template-designer.inspector.root-hint')}</S.Hint>}
      {inspector.tools && (
        <S.Tools>
          <S.Tool type="button" title={t('template-designer.tool.before')} disabled={!inspector.tools.canMoveUp} onClick={() => vm.moveSelected(-1)}>
            <RiArrowUpLine size={14} />
          </S.Tool>
          <S.Tool type="button" title={t('template-designer.tool.after')} disabled={!inspector.tools.canMoveDown} onClick={() => vm.moveSelected(1)}>
            <RiArrowDownLine size={14} />
          </S.Tool>
          <S.Tool type="button" title={t('template-designer.tool.duplicate')} disabled={!inspector.tools.canDuplicate} onClick={vm.duplicateSelected}>
            <RiFileCopyLine size={14} />
          </S.Tool>
          {inspector.tools.wrapOptions.map((option) => (
            <S.Tool
              key={option.type}
              type="button"
              title={t('template-designer.tool.wrap', { container: option.label })}
              disabled={option.disabled}
              onClick={() => vm.wrapSelected(option.type)}
            >
              <option.icon size={14} />
            </S.Tool>
          ))}
          {inspector.tools.canUnwrap && (
            <S.Tool type="button" title={t('template-designer.tool.unwrap')} onClick={vm.unwrapSelected}>
              <RiLayoutMasonryLine size={14} />
            </S.Tool>
          )}
          <S.Tool type="button" $danger title={t('template-designer.tool.remove')} onClick={vm.removeSelected}>
            <RiDeleteBinLine size={14} />
          </S.Tool>
        </S.Tools>
      )}
      {inspector.issues.map((issue) => <InfoBanner key={issue} variant="warning" message={issue} />)}
      {inspector.properties.map((property) => <PropertyEditor key={property.key} property={property} vm={vm} />)}
      {!inspector.isRoot && inspector.properties.length === 0 && <S.Hint>{t('template-designer.inspector.no-properties')}</S.Hint>}
    </S.Side>
  );
};

/**
 * O designer visual de um template declarativo — paleta, canvas e propriedades. Genérico: o que existe
 * para desenhar vem do vocabulário (`TemplateVocabulary`); o cartão da listagem é um deles.
 */
export const TemplateDesigner: React.FC<TemplateDesignerProps> = (props) => {
  const vm = useTemplateDesignerViewModel(props);
  const t = useT('core.records');
  return (
    <S.Designer onKeyDown={vm.keyDown}>
      {vm.globalIssues.map((issue) => <InfoBanner key={issue} variant="warning" message={issue} />)}
      <S.Workspace>
        <S.SideTabs role="tablist">
          <S.SideTab type="button" role="tab" aria-selected={vm.sideTab === 'palette'} $active={vm.sideTab === 'palette'} onClick={() => vm.setSideTab('palette')}>
            {t('template-designer.tab.palette')}
          </S.SideTab>
          <S.SideTab type="button" role="tab" aria-selected={vm.sideTab === 'properties'} $active={vm.sideTab === 'properties'} onClick={() => vm.setSideTab('properties')}>
            {t('template-designer.tab.properties')}
          </S.SideTab>
        </S.SideTabs>

        <S.Side $active={vm.sideTab === 'palette'} $area="palette" data-testid="designer-palette">
          <S.SideTitle>{t('template-designer.tab.palette')}</S.SideTitle>
          <S.Hint>{t(vm.paletteFull ? 'template-designer.palette.full' : 'template-designer.palette.hint')}</S.Hint>
          {vm.palette.map((group) => (
            <S.PaletteGroup key={group.key}>
              <S.GroupTitle>{group.label}</S.GroupTitle>
              <S.PaletteItems>
                {group.items.map((item) => (
                  <S.PaletteItem
                    key={item.id}
                    type="button"
                    data-testid={`designer-palette-${item.id}`}
                    draggable={!item.disabled}
                    disabled={item.disabled}
                    title={item.label}
                    onClick={() => vm.addFromPalette(item.id)}
                    onDragStart={(event) => vm.startPaletteDrag(item.id, event)}
                    onDragEnd={vm.endDrag}
                  >
                    <item.icon size={14} />
                    <span>{item.label}</span>
                  </S.PaletteItem>
                ))}
              </S.PaletteItems>
            </S.PaletteGroup>
          ))}
        </S.Side>

        <S.CanvasColumn>
          <S.Canvas
            tabIndex={0}
            data-designer-canvas
            data-testid="designer-canvas"
            aria-label={t('template-designer.canvas.label')}
            $dragging={vm.dragging}
            onClick={vm.clearSelection}
            onDragOver={vm.dragOverCanvas}
            onDrop={vm.drop}
          >
            <S.CardShell>
              {vm.empty && <S.EmptyCanvas>{t('template-designer.canvas.empty')}</S.EmptyCanvas>}
              <NodeList nodes={vm.nodes} slots={vm.rootSlots} direction="column" vm={vm} />
            </S.CardShell>
          </S.Canvas>
          {vm.preview}
        </S.CanvasColumn>

        <Inspector vm={vm} />
      </S.Workspace>
    </S.Designer>
  );
};
