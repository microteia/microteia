import React from 'react';
import { Input } from '../../../../../../components/ui/Input';
import { SearchSelect } from '../../../../../../components/ui/SearchSelect';
import { useEntityReferenceControlViewModel } from './EntityReferenceControl.viewmodel';
import type { EntityReferenceControlProps } from './EntityReferenceControl.viewmodel';

export const EntityReferenceControl: React.FC<EntityReferenceControlProps> = ({ input, value, onChange }) => {
  const options = useEntityReferenceControlViewModel(input);

  if (!input.entityType) {
    return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={input.description} />;
  }

  return <SearchSelect options={options} value={value} onChange={onChange} placeholder="Selecione..." />;
};
