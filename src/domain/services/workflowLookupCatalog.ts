import { LOOKUP_REGISTRY_LIST, getLookupLabel, type LookupGroup, type LookupMetadata } from '../schema/lookupRegistry';

export type WorkflowLookupGroup = LookupGroup;

export type WorkflowLookupCollectionEntry = LookupMetadata;

export const WORKFLOW_LOOKUP_COLLECTIONS: WorkflowLookupCollectionEntry[] = LOOKUP_REGISTRY_LIST;

export const getWorkflowLookupCollectionLabel = getLookupLabel;
