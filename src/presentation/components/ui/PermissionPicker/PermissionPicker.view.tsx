import React from 'react';
import { RiArrowDownSLine, RiArrowRightSLine } from 'react-icons/ri';
import type { PermissionPickerInput } from './PermissionPicker.viewmodel';
import { usePermissionPickerViewModel } from './PermissionPicker.viewmodel';
import { S } from './PermissionPicker.styles.tsx';
import { Checkbox } from '../Checkbox';
import { Button } from '../Button';
import { useT } from '../../../shared/i18n/useT';

export const PermissionPicker: React.FC<PermissionPickerInput> = (input) => {
  const vm = usePermissionPickerViewModel(input);
  const t = useT('core.access');

  if (!vm.hasOfferable) return <S.Empty>{t('permission.picker.nothing-to-offer')}</S.Empty>;

  return (
    <S.Container>
      <S.Toolbar>
        <S.Search
          value={vm.query}
          onChange={(event) => vm.setQuery(event.target.value)}
          placeholder={t('permission.picker.search')}
        />
        <S.Count>
          {t('permission.picker.selected', {
            selected: String(vm.totalSelected),
            total: String(vm.totalOfferable),
          })}
        </S.Count>
        {vm.totalSelected > 0 && (
          <Button variant="ghost" size="sm" onClick={vm.clearAll}>
            {t('permission.picker.clear')}
          </Button>
        )}
      </S.Toolbar>

      <S.List>
        {vm.noMatches ? (
          <S.Empty>{t('permission.picker.no-matches')}</S.Empty>
        ) : vm.groups.map((group) => (
          <S.Group key={group.resource}>
            <S.GroupHeader>
              <S.Disclosure
                type="button"
                onClick={() => vm.toggleExpanded(group.resource)}
                aria-label={group.name}
              >
                {group.expanded ? <RiArrowDownSLine /> : <RiArrowRightSLine />}
              </S.Disclosure>
              <Checkbox
                label={group.name}
                checked={group.allSelected}
                indeterminate={group.someSelected}
                onChange={(checked) => vm.toggleGroup(group.resource, checked)}
              />
              <S.GroupCount>
                {t('permission.picker.group-count', {
                  selected: String(group.selectedCount),
                  total: String(group.rows.length),
                })}
              </S.GroupCount>
            </S.GroupHeader>

            {group.expanded && (
              <S.Rows>
                {group.rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <S.Row>
                      <Checkbox
                        label={row.name}
                        checked={row.checked}
                        onChange={(checked) => vm.togglePermission(row.id, checked)}
                      />
                    </S.Row>
                    {row.requiredBy.length > 0 && (
                      <S.RowNote $warning={!row.checked}>
                        {t(
                          row.checked
                            ? 'permission.picker.included-by'
                            : 'permission.picker.missing-for',
                          { by: row.requiredBy.join(', ') },
                        )}
                      </S.RowNote>
                    )}
                  </React.Fragment>
                ))}
              </S.Rows>
            )}
          </S.Group>
        ))}
      </S.List>
    </S.Container>
  );
};
