import { useMemo, useState, useCallback } from 'react';
import { useTheme } from 'styled-components';
import type { FilterDef } from '@microteia/ui';
import { CompositeFilter, SearchSelect } from '@microteia/ui';
import {
  useCollection, useUpdateRecord, useLookup,
  useOpenRecord, useNotify, useSavedViewState,
} from '@microteia/data';

const CASES = 'cases';

const inList = (values, value) => Array.isArray(values) && value != null && values.indexOf(value) !== -1;

function matchesTokens(caseItem, tokens) {
  for (const token of tokens) {
    const values = token.values || [];
    if (values.length === 0) continue;
    if (token.key === 'lawyer' && !inList(values, caseItem.responsibleLawyerId)) return false;
    if (token.key === 'area' && !inList(values, caseItem.area)) return false;
    if (token.key === 'status' && !inList(values, caseItem.status)) return false;
  }
  return true;
}

export default function KanbanCasesView() {
  const theme = useTheme();
  const cases = useCollection(CASES);
  const updateRecord = useUpdateRecord();
  const phases = useLookup('casePhases');
  const areas = useLookup('caseAreas');
  const statuses = useLookup('caseStatuses');
  const persons = useCollection('persons');
  const openRecord = useOpenRecord();
  const notify = useNotify();

  const [state, setState] = useSavedViewState('kanban.cases', { columns: null, tokens: [] });
  const [draggedId, setDraggedId] = useState(null);
  const [overPhase, setOverPhase] = useState(null);

  const allPhaseKeys = useMemo(() => phases.map((p) => p.key), [phases]);
  const phaseByKey = useMemo(() => {
    const map = {};
    for (const p of phases) map[p.key] = p;
    return map;
  }, [phases]);
  const personById = useMemo(() => {
    const map = {};
    for (const p of persons) map[p.id] = p;
    return map;
  }, [persons]);

  const tokens = useMemo(() => state.tokens || [], [state.tokens]);
  const columns = useMemo(() => {
    const chosen = state.columns == null ? allPhaseKeys : state.columns;
    return chosen.filter((k) => allPhaseKeys.indexOf(k) !== -1);
  }, [state.columns, allPhaseKeys]);

  const setColumns = useCallback((next) => setState({ columns: next, tokens }), [setState, tokens]);
  const setTokens = useCallback((next) => setState({ columns: state.columns, tokens: next }), [setState, state.columns]);

  const filtered = useMemo(() => cases.filter((c) => matchesTokens(c, tokens)), [cases, tokens]);

  const filterDefs: FilterDef[] = useMemo(() => [
    { key: 'lawyer', label: 'Advogado', type: 'multiselect', options: persons.map((p) => ({ value: p.id, label: p.name })) },
    { key: 'area', label: 'Área', type: 'multiselect', options: areas.map((a) => ({ value: a.key, label: a.label })) },
    { key: 'status', label: 'Status', type: 'multiselect', options: statuses.map((s) => ({ value: s.key, label: s.label, color: s.color })) },
  ], [persons, areas, statuses]);

  const availableToAdd = allPhaseKeys.filter((k) => columns.indexOf(k) === -1);

  const onDrop = useCallback((phaseKey) => {
    setOverPhase(null);
    const id = draggedId;
    setDraggedId(null);
    if (!id) return;
    const item = cases.find((c) => c.id === id);
    if (!item || item.phase === phaseKey) return;
    updateRecord(CASES, id, { phase: phaseKey })
      .then(() => notify('Processo movido para "' + (phaseByKey[phaseKey] ? phaseByKey[phaseKey].label : phaseKey) + '".', 'success'))
      .catch(() => notify('Não foi possível mover o processo.', 'error'));
  }, [draggedId, cases, updateRecord, notify, phaseByKey]);

  const page = { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' };
  const header = { padding: '16px 20px', borderBottom: '1px solid ' + theme.colors.border, display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 };
  const board = { flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: '14px', padding: '16px 20px', alignItems: 'stretch' };
  const columnStyle = (active) => ({ display: 'flex', flexDirection: 'column', width: '280px', minWidth: '280px', background: theme.colors.surface, border: '1px solid ' + (active ? theme.colors.primary : theme.colors.border), borderRadius: theme.borderRadius.md, overflow: 'hidden' });
  const colHead = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid ' + theme.colors.border };
  const colBody = { display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', overflowY: 'auto', flex: 1 };
  const dot = (color) => ({ width: '10px', height: '10px', borderRadius: '50%', background: color || theme.colors.textSecondary, flexShrink: 0 });
  const titleStyle = { fontSize: theme.fontSizes.sm, fontWeight: 600, color: theme.colors.text, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const countStyle = { fontSize: theme.fontSizes.xs, color: theme.colors.textSecondary };
  const removeBtn = { cursor: 'pointer', color: theme.colors.textSecondary, background: 'none', border: 'none', fontSize: theme.fontSizes.md, lineHeight: 1, padding: '0 2px' };
  const cardStyle = (color) => ({ borderLeft: '3px solid ' + (color || theme.colors.primary), background: theme.colors.background, border: '1px solid ' + theme.colors.border, borderRadius: theme.borderRadius.sm, padding: '10px', cursor: 'grab' });
  const cardTitle = { fontSize: theme.fontSizes.sm, fontWeight: 600, color: theme.colors.text, marginBottom: '4px' };
  const cardMeta = { fontSize: theme.fontSizes.xs, color: theme.colors.textSecondary };
  const addSelect = { alignSelf: 'flex-start' };

  return (
    <div style={page}>
      <div style={header}>
        <div style={{ fontSize: theme.fontSizes.lg, fontWeight: 700, color: theme.colors.text }}>Kanban de Processos</div>
        <CompositeFilter defs={filterDefs} tokens={tokens} onChange={setTokens} screenKey="kanban.cases" placeholder="Filtrar processos..." />
      </div>
      <div style={board}>
        {columns.map((key) => {
          const phase = phaseByKey[key];
          const items = filtered.filter((c) => c.phase === key);
          const active = overPhase === key;
          return (
            <div
              key={key}
              style={columnStyle(active)}
              onDragOver={(e) => { e.preventDefault(); if (overPhase !== key) setOverPhase(key); }}
              onDragLeave={() => setOverPhase((p) => (p === key ? null : p))}
              onDrop={() => onDrop(key)}
            >
              <div style={colHead}>
                <span style={dot(phase && phase.color)} />
                <span style={titleStyle}>{phase ? phase.label : key}</span>
                <span style={countStyle}>{items.length}</span>
                <button type="button" style={removeBtn} title="Remover coluna" onClick={() => setColumns(columns.filter((k) => k !== key))}>×</button>
              </div>
              <div style={colBody}>
                {items.map((c) => {
                  const lawyer = c.responsibleLawyerId ? personById[c.responsibleLawyerId] : null;
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDraggedId(c.id)}
                      onDragEnd={() => { setDraggedId(null); setOverPhase(null); }}
                      onClick={() => openRecord(CASES, c.id)}
                      style={cardStyle(phase && phase.color)}
                    >
                      <div style={cardTitle}>{c.title || c.caseNumber || 'Processo'}</div>
                      <div style={cardMeta}>{c.caseNumber || ''}{lawyer ? ' · ' + lawyer.name : ''}</div>
                    </div>
                  );
                })}
                {items.length === 0 ? <div style={{ fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, fontStyle: 'italic', padding: '4px' }}>Sem processos</div> : null}
              </div>
            </div>
          );
        })}
        {availableToAdd.length > 0 ? (
          <div style={{ minWidth: '220px' }}>
            <AddColumn options={availableToAdd.map((k) => ({ value: k, label: phaseByKey[k] ? phaseByKey[k].label : k }))} onAdd={(k) => setColumns([...columns, k])} style={addSelect} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AddColumn(props) {
  return (
    <SearchSelect
      options={props.options}
      value=""
      onChange={(v) => { if (v) props.onAdd(v); }}
      placeholder="+ Adicionar coluna (Fase)"
    />
  );
}
