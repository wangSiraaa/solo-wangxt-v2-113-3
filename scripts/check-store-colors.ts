import assert from 'node:assert/strict';
import { get, writable } from 'svelte/store';
import type { Project } from '../src/types';
import {
  editor,
  setProject,
  applyColorPreset,
  setGroup,
  undo
} from '../src/lib/stores';
import { p4mFourColorConfig, pgGlideColorConfig, normalizeProject } from '../src/lib/color';

function makeProject(group: Project['group'], width: number, height: number, config = undefined): Project {
  return normalizeProject({
    id: `project-${group}`,
    name: group,
    group,
    cellWidth: width,
    cellHeight: height,
    objects: [
      {
        id: 'source-id',
        name: 'source',
        path: [{ type: 'M', x: 0, y: 0 }, { type: 'L', x: 10, y: 0 }, { type: 'Z' }],
        fill: '#000000',
        stroke: '#ffffff',
        strokeWidth: 1,
        opacity: 1
      }
    ],
    updatedAt: 0,
    colorConfig: config
  });
}

assert.equal(setProject(makeProject('p4m', 240, 240), true), undefined);
const before = get(editor);
assert.equal(applyColorPreset(p4mFourColorConfig()), true);
const colored = get(editor);
assert.equal(colored.project.objects.length, 1);
assert.equal(colored.project.objects[0]?.id, 'source-id');
assert.equal(colored.project.colorConfig.roles.length, 4);
assert.equal(setGroup('pg'), false);
const rejected = get(editor);
assert.equal(rejected.project.group, 'p4m');
assert.equal(rejected.project.colorConfig.roles.length, 4);
assert.ok(rejected.colorConflict.includes('色彩角色映射'));
undo();
const restored = get(editor);
assert.equal(restored.project.group, 'p4m');
assert.equal(restored.project.colorConfig.roles.length, 1);
assert.equal(restored.project.objects[0]?.id, 'source-id');
assert.equal(restored.colorConflict, null);

assert.equal(setProject(makeProject('pg', 260, 200, pgGlideColorConfig()), true), undefined);
assert.equal(setGroup('p4m'), false);
const pgStill = get(editor);
assert.equal(pgStill.project.group, 'pg');
assert.equal(pgStill.project.colorConfig.roles.length, 2);
assert.equal(pgStill.project.objects[0]?.id, 'source-id');

console.log('✓ rejected group changes preserve saved roles and undo restores the color scheme');
