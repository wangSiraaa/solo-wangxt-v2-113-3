import assert from 'node:assert/strict';
import type { Project } from '../src/types';
import {
  IDENTITY_ROLE_ID,
  deriveColorSupercell,
  normalizeProject,
  p4mFourColorConfig,
  pgGlideColorConfig,
  roleForInstance,
  styleForRole,
  validateColorConfig
} from '../src/lib/color';

function test(name: string, body: () => void) {
  body();
  console.log(`✓ ${name}`);
}

test('p4m rotation roles close after four generators and use one source object', () => {
  const config = p4mFourColorConfig();
  assert.equal(validateColorConfig('p4m', config).length, 0);
  const oldProject: Project = normalizeProject({
    id: 'p4m-color',
    name: 'p4m color',
    group: 'p4m' as const,
    cellWidth: 240,
    cellHeight: 240,
    objects: [
      {
        id: 'only-source',
        name: 'source',
        path: [{ type: 'M', x: 0, y: 0 }, { type: 'L', x: 1, y: 0 }, { type: 'Z' }],
        fill: '#111111',
        stroke: '#222222',
        strokeWidth: 2,
        opacity: 0.7
      }
    ],
    updatedAt: 0,
    colorConfig: config,
    colorSupercell: undefined
  });
  const rotationRoles = [0, 1, 2, 3].map((coset) => roleForInstance(oldProject, coset, 0, 0));
  assert.deepEqual(rotationRoles, [
    IDENTITY_ROLE_ID,
    'role-90',
    'role-180',
    'role-270'
  ]);
  assert.equal(roleForInstance(oldProject, 0, 4, 0), rotationRoles[0]);
  const supercellRoles = Array.from(new Set(Array.from({ length: 8 }, (_, coset) => roleForInstance(oldProject, coset, 0, 0))));
  assert.equal(supercellRoles.length, 4);
  assert.equal(oldProject.objects.length, 1);
  assert.equal(oldProject.objects[0]?.id, 'only-source');
  assert.deepEqual(oldProject.colorSupercell.repeats, [1, 1]);
  assert.equal(styleForRole(oldProject.objects[0]!, rotationRoles[1]!, oldProject.colorConfig).fill, '#2563eb');
  assert.equal(styleForRole(oldProject.objects[0]!, rotationRoles[0]!, oldProject.colorConfig).opacity, 0.7);
});

test('pg rejects a glide permutation whose square does not match translation', () => {
  const valid = pgGlideColorConfig();
  assert.equal(validateColorConfig('pg', valid).length, 0);
  const roles = valid.roles.map((role) => role.id);
  const invalid = structuredClone(valid);
  invalid.generatorPermutations.g = Object.fromEntries(roles.map((id) => [id, id]));
  invalid.generatorPermutations['t₂'] = Object.fromEntries(roles.map((id) => [id, id]));
  // Add two finite-color roles so g can be a genuine 4-cycle while t1 is identity.
  invalid.roles.push(
    { id: 'role-a', name: 'A', fill: '#fff', stroke: '#000', opacity: null },
    { id: 'role-b', name: 'B', fill: '#eee', stroke: '#000', opacity: null }
  );
  invalid.generatorPermutations.g = {
    [IDENTITY_ROLE_ID]: 'role-glide',
    'role-glide': 'role-a',
    'role-a': 'role-b',
    'role-b': IDENTITY_ROLE_ID
  };
  for (const map of Object.values(invalid.generatorPermutations)) {
    for (const role of invalid.roles) map[role.id] ??= role.id;
  }
  const issues = validateColorConfig('pg', invalid);
  assert.ok(issues.some((issue) => issue.symbol.startsWith('g² = t₁')));
});

test('incompatible target group rejects the saved pg color map without altering it', () => {
  const pgConfig = pgGlideColorConfig();
  const issues = validateColorConfig('p4m', pgConfig);
  assert.ok(issues.length > 0);
  assert.equal(pgConfig.generatorPermutations.g['role-glide'], IDENTITY_ROLE_ID);
  assert.equal(pgConfig.roles.length, 2);
});

test('legacy monochrome project migrates to identity without changing derived style or tile size', () => {
  const legacy = {
    id: 'legacy',
    name: 'legacy',
    group: 'p6m' as const,
    cellWidth: 280,
    cellHeight: Math.round((Math.sqrt(3) / 2) * 280),
    objects: [
      {
        id: 'legacy-source',
        name: 'legacy',
        path: [{ type: 'M' as const, x: 1, y: 2 }, { type: 'Z' as const }],
        fill: '#14b8a6',
        stroke: '#134e4a',
        strokeWidth: 2,
        opacity: 0.42
      }
    ],
    updatedAt: 123
  };
  const migrated = normalizeProject(legacy);
  assert.equal(migrated.colorConfig.roles.length, 1);
  assert.equal(migrated.colorConfig.roles[0]?.id, IDENTITY_ROLE_ID);
  assert.deepEqual(deriveColorSupercell('p6m', legacy.cellWidth, legacy.cellHeight, migrated.colorConfig).repeats, [1, 1]);
  const roleId = roleForInstance(migrated, 5, 7, -3);
  const style = styleForRole(migrated.objects[0]!, roleId, migrated.colorConfig);
  assert.deepEqual(style, {
    fill: '#14b8a6',
    stroke: '#134e4a',
    strokeWidth: 2,
    opacity: 0.42
  });
  assert.equal(migrated.objects[0]?.id, 'legacy-source');
});
