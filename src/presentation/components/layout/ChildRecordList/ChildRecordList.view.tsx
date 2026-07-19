import React from 'react';
import { useChildRecordListViewModel } from './ChildRecordList.viewmodel';
import type { ChildRecordListParams } from './ChildRecordList.viewmodel';
import { RecordListSurface } from '../RecordListSurface';

export const ChildRecordList: React.FC<ChildRecordListParams> = (params) => {
  const vm = useChildRecordListViewModel(params);
  const definition = vm.definition;

  if (!definition) return null;

  return <RecordListSurface vm={vm} definition={definition} variant="embedded" />;
};
