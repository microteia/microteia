import type { InputMapping } from '../entities/Workflow';

export interface MapFieldMapping {
  name: string;
  value: InputMapping;
}

export interface MapStepConfig {
  name: string;
  type?: string;
  fields: MapFieldMapping[];
}
