import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import { rotationSample } from '../src/lib/samples.ts';
import { editor, redo, setProject, undo, updateColorScheme } from '../src/lib/stores.ts';

const project = rotationSample();
const objectId = project.objects[0]!.id;
setProject(project);
updateColorScheme((scheme) => ({
  roles: [
    { id: 'identity', name: '恒等角色', fill: null, stroke: null, opacity: null },
    { id: 'b', name: '二色', fill: '#123456', stroke: null, opacity: null }
  ],
  actions: {
    't₁': [0, 1],
    't₂': [0, 1],
    'r₄': [0, 1],
    s: [0, 1]
  },
  supercell: { n: 1, m: 1 }
}));
assert.equal(get(editor).project.objects[0]!.id, objectId);
undo();
assert.equal(get(editor).project.objects[0]!.id, objectId);
assert.equal(get(editor).project.colorScheme.roles.length, 1);
redo();
assert.equal(get(editor).project.objects[0]!.id, objectId);
assert.equal(get(editor).project.colorScheme.roles.length, 2);
console.log('history identity checks passed');
