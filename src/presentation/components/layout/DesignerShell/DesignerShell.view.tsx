import React from 'react';
import { DS } from './DesignerShell.styles';
import type { DesignerTileTone } from './DesignerShell.styles';

export interface DesignerMetaItem {
  text: string;
  /** Um identificador (a chave do documento), em fonte monoespaçada. */
  code?: boolean;
}

interface DesignerHeaderProps {
  icon: React.ReactNode;
  tone?: DesignerTileTone;
  name: string;
  meta: DesignerMetaItem[];
  /** Selos ao lado do nome: o estado, a extensão dona. */
  badges?: React.ReactNode;
  actions: React.ReactNode;
}

/** A identidade da autoria: o tipo, o nome, de onde vem, e as ações à direita. */
export const DesignerHeader: React.FC<DesignerHeaderProps> = ({ icon, tone = 'primary', name, meta, badges, actions }) => (
  <DS.Header>
    <DS.HeaderMain>
      <DS.Tile $tone={tone}>{icon}</DS.Tile>
      <DS.HeaderText>
        <DS.HeaderName>{name}</DS.HeaderName>
        {meta.length > 0 && (
          <DS.HeaderMeta>
            {meta.map((item, index) => (
              <React.Fragment key={`${index}:${item.text}`}>
                {index > 0 && <DS.MetaSeparator />}
                {item.code ? <DS.MetaKey>{item.text}</DS.MetaKey> : <span>{item.text}</span>}
              </React.Fragment>
            ))}
          </DS.HeaderMeta>
        )}
      </DS.HeaderText>
      {badges}
    </DS.HeaderMain>
    <DS.HeaderActions>{actions}</DS.HeaderActions>
  </DS.Header>
);

export interface DesignerTab<K extends string = string> {
  key: K;
  label: string;
  /** Quantos itens a aba declara — 0 não mostra contador. */
  count: number;
  /** Quantos problemas moram nos campos da aba. */
  issueCount?: number;
  /** Algum deles impede salvar. */
  hasBlockingIssue?: boolean;
}

interface DesignerTabsProps<K extends string> {
  tabs: DesignerTab<K>[];
  active: K;
  onSelect: (key: K) => void;
  panelId: string;
  issuesTitle: (count: number) => string;
}

/** As abas da autoria, com o que cada uma declara e os problemas que moram nela. */
export const DesignerTabs = <K extends string>({ tabs, active, onSelect, panelId, issuesTitle }: DesignerTabsProps<K>) => (
  <DS.TabBar role="tablist">
    {tabs.map((tab) => (
      <DS.TabBtn
        key={tab.key}
        type="button"
        role="tab"
        aria-selected={tab.key === active}
        aria-controls={panelId}
        $active={tab.key === active}
        onClick={() => onSelect(tab.key)}
      >
        {tab.label}
        {tab.count > 0 && <DS.TabCount $active={tab.key === active}>{tab.count}</DS.TabCount>}
        {(tab.issueCount ?? 0) > 0 && (
          <DS.TabIssues $blocking={tab.hasBlockingIssue === true} title={issuesTitle(tab.issueCount ?? 0)}>
            {tab.issueCount}
          </DS.TabIssues>
        )}
      </DS.TabBtn>
    ))}
  </DS.TabBar>
);
