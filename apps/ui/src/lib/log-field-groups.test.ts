import { describe, expect, it } from 'vitest';
import { fieldLabel, groupLogFields } from './log-field-groups';

const fields = [
  { name: 'level', kind: 'core' as const, count: 0 },
  { name: 'service', kind: 'core' as const, count: 0 },
  { name: 'traceId', kind: 'core' as const, count: 0 },
  { name: 'attributes.http.route', kind: 'attribute' as const, count: 24 },
];

describe('groupLogFields', () => {
  it('pulls level and service out as quick filters', () => {
    const groups = groupLogFields(fields, '');
    expect(groups.quick.map((field) => field.name)).toEqual(['level', 'service']);
    expect(groups.core.map((field) => field.name)).toEqual(['traceId']);
    expect(groups.attributes).toHaveLength(1);
  });

  it('filters every group by the search text', () => {
    const groups = groupLogFields(fields, 'route');
    expect(groups.quick).toHaveLength(0);
    expect(groups.core).toHaveLength(0);
    expect(groups.attributes).toHaveLength(1);
  });

  it('drops the attributes prefix from labels', () => {
    expect(fieldLabel('attributes.http.route')).toBe('http.route');
    expect(fieldLabel('level')).toBe('level');
  });
});
