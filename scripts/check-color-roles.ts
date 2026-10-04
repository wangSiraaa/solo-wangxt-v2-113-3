import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import { rotationSample, glideSample } from '../src/lib/samples.ts';
import { identityColorScheme, instanceRoleIndex, normalizeProject, validateColorScheme } from '../src/lib/color.ts';
import { GROUP_LIST } from '../src/lib/groups.ts';
import { prepareColorScheme } from '../src/lib/color.ts';
import { editor, setGroup, setProject } from '../src/lib/stores.ts';
import type { ColorScheme, Project } from '../src/types.ts';

const p4m = rotationSample();
p4m.objects = p4m.objects.slice(0, 1);
const fourRoles = {
  roles: [
    { id: 'r0', name: '0', fill: '#f00', stroke: null, opacity: null },
    { id: 'r1', name: '1', fill: '#0f0', stroke: null, opacity: null },
    { id: 'r2', name: '2', fill: '#00f', stroke: null, opacity: null },
    { id: 'r3', name: '3', fill: '#ff0', stroke: null, opacity: null }
  ],
  actions: {
    't₁': [0, 1, 2, 3],
    't₂': [0, 1, 2, 3],
    'r₄': [1, 2, 3, 0],
    s: [0, 3, 2, 1]
  },
  supercell: { n: 1, m: 1 }
};
p4m.colorScheme = fourRoles;
setProject(p4m);
const p4mValidation = validateColorScheme('p4m', fourRoles);
assert.equal(p4mValidation.valid, true, p4mValidation.errors.join('\n'));
assert.deepEqual(p4mValidation.supercell, { n: 1, m: 1 });
assert.deepEqual([0, 1, 2, 3].map((coset) => instanceRoleIndex(p4m, coset, 0, 0)), [0, 1, 2, 3]);
assert.equal(instanceRoleIndex(p4m, 0, 4, 0), 0);
assert.equal(p4m.objects.length, 1);

const pg = glideSample();
const validGlide: ColorScheme = {
  roles: [
    { id: 'a', name: 'a', fill: '#fff', stroke: null, opacity: null },
    { id: 'b', name: 'b', fill: '#000', stroke: null, opacity: null }
  ],
  actions: { 't₁': [0, 1], 't₂': [0, 1], g: [1, 0] },
  supercell: { n: 1, m: 1 }
};
const validGlideValidation = validateColorScheme('pg', validGlide);
assert.equal(validGlideValidation.valid, true, validGlideValidation.errors.join('\n'));
const invalidGlide: ColorScheme = {
  ...validGlide,
  actions: { 't₁': [1, 0], 't₂': [0, 1], g: [1, 0] },
  supercell: { n: 2, m: 1 }
};
const invalidValidation = validateColorScheme('pg', invalidGlide);
assert.equal(invalidValidation.valid, false);
assert.match(invalidValidation.errors.join('\n'), /g² = t₁/);

const prepared = prepareColorScheme('pg', fourRoles);
assert.equal(validateColorScheme('pg', prepared).valid, false);
assert.match(validateColorScheme('pg', prepared).errors.join('\n'), /r₄/);
assert.equal(setGroup('pg'), false);
assert.equal(get(editor).project.group, 'p4m');
assert.deepEqual(get(editor).project.colorScheme.roles, fourRoles.roles);

for (const group of GROUP_LIST.map((spec) => spec.id)) {
  assert.equal(validateColorScheme(group, identityColorScheme(group)).valid, true);
}

const legacy = { ...glideSample() } as unknown as Project;
delete (legacy as Partial<Project>).colorScheme;
const migrated = normalizeProject(legacy);
assert.equal(migrated.colorScheme.roles.length, 1);
assert.deepEqual(migrated.colorScheme.actions['t₁'], [0]);
assert.equal(migrated.colorScheme.roles[0]!.fill, null);
assert.equal(migrated.colorScheme.roles[0]!.stroke, null);
assert.equal(migrated.colorScheme.roles[0]!.opacity, null);
assert.equal(migrated.objects.length, legacy.objects.length);

assert.deepEqual(validateColorScheme('p1', identityColorScheme('p1')).supercell, { n: 1, m: 1 });
console.log('color role acceptance checks passed');
