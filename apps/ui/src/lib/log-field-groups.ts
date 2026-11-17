import type { LogFieldName } from './log-types';
import { QUICK_FIELDS } from './log-field-groups.constants';

export interface LogFieldGroups {
  quick: LogFieldName[];
  core: LogFieldName[];
  attributes: LogFieldName[];
}

export function groupLogFields(fields: LogFieldName[], query: string): LogFieldGroups {
  const needle = query.trim().toLowerCase();
  const matches = (field: LogFieldName) => !needle || field.name.toLowerCase().includes(needle);
  const quick = QUICK_FIELDS.flatMap((name) => fields.filter((field) => field.name === name && matches(field)));
  const rest = fields.filter((field) => !QUICK_FIELDS.includes(field.name) && matches(field));
  const core = rest.filter((field) => field.kind === 'core');
  const coreNames = new Set(fields.filter((field) => field.kind === 'core').map((field) => field.name));
  const attributes = rest.filter((field) => field.kind === 'attribute' && !coreNames.has(fieldLabel(field.name)));
  return { quick, core, attributes };
}

export function fieldLabel(name: string): string {
  return name.replace(/^attributes\./, '');
}
