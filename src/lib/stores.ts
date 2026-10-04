import { get, writable } from 'svelte/store';
import type { ColorConfig, GroupId, PatternObject, Project, RenderOptions, Tool } from '../types';
import { defaultProject } from './samples';
import { cloneObject } from './path';
import { GROUP_SPECS } from './groups';
import {
  deriveColorSupercell,
  identityColorRole,
  normalizeProject,
  validateColorConfig
} from './color';

export interface EditorState {
  project: Project;
  selectedId: string | null;
  /** Identity of the concrete transformed path that was clicked, e.g. objectId@coset:n,m. */
  selectedInstance: string | null;
  selectedRoleId: string | null;
  tool: Tool;
  canUndo: boolean;
  canRedo: boolean;
  saved: boolean;
  colorConflict: string | null;
}

interface HistoryEntry {
  project: Project;
  selectedId: string | null;
  selectedInstance: string | null;
  selectedRoleId: string | null;
}

const initialProject = defaultProject();
const editorStore = writable<EditorState>({
  project: initialProject,
  selectedId: initialProject.objects[0]?.id ?? null,
  selectedInstance: null,
  selectedRoleId: null,
  tool: 'select',
  canUndo: false,
  canRedo: false,
  saved: false,
  colorConflict: null
});

const undoStack: HistoryEntry[] = [];
const redoStack: HistoryEntry[] = [];

function snapshot(state: EditorState): HistoryEntry {
  return {
    project: structuredClone(state.project),
    selectedId: state.selectedId,
    selectedInstance: state.selectedInstance,
    selectedRoleId: state.selectedRoleId
  };
}

function historyEntry(project: Project, state: EditorState): EditorState {
  return {
    ...state,
    project,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    saved: false,
    colorConflict: null
  };
}

export function pushHistory() {
  const state = get(editorStore);
  undoStack.push(snapshot(state));
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
  editorStore.update((s) => ({ ...s, canUndo: true, canRedo: false, saved: false, colorConflict: null }));
}

export function undo() {
  const entry = undoStack.pop();
  if (!entry) return;
  editorStore.update((state) => {
    redoStack.push(snapshot(state));
    return {
      ...state,
      project: structuredClone(entry.project),
      selectedId: entry.selectedId,
      selectedInstance: entry.selectedInstance,
      selectedRoleId: entry.selectedRoleId,
      canUndo: undoStack.length > 0,
      canRedo: true,
      saved: false,
      colorConflict: null
    };
  });
}

export function redo() {
  const entry = redoStack.pop();
  if (!entry) return;
  editorStore.update((state) => {
    undoStack.push(snapshot(state));
    return {
      ...state,
      project: structuredClone(entry.project),
      selectedId: entry.selectedId,
      selectedInstance: entry.selectedInstance,
      selectedRoleId: entry.selectedRoleId,
      canUndo: true,
      canRedo: redoStack.length > 0,
      saved: false,
      colorConflict: null
    };
  });
}

export function updateProject(mutator: (project: Project) => Project, record = true) {
  if (record) pushHistory();
  editorStore.update((state) => {
    const project = normalizeProject(mutator(structuredClone(state.project)));
    return { ...state, project, saved: false, colorConflict: null };
  });
}

export function setProject(project: Project, clearHistory = true) {
  const normalized = normalizeProject(structuredClone(project));
  if (clearHistory) {
    undoStack.length = 0;
    redoStack.length = 0;
  }
  editorStore.set({
    project: normalized,
    selectedId: normalized.objects[0]?.id ?? null,
    selectedInstance: null,
    selectedRoleId: null,
    tool: 'select',
    canUndo: false,
    canRedo: false,
    saved: false,
    colorConflict: null
  });
}

export function selectObject(id: string | null, instance: string | null = null, roleId: string | null = null) {
  editorStore.update((state) => ({ ...state, selectedId: id, selectedInstance: instance, selectedRoleId: roleId }));
}

export function setTool(tool: Tool) {
  editorStore.update((state) => ({ ...state, tool }));
}

function colorConflictMessage(group: GroupId, config: ColorConfig): string {
  return validateColorConfig(group, config)
    .map((issue) => issue.message)
    .join(' ');
}

export function setGroup(group: GroupId): boolean {
  const state = get(editorStore);
  const current = state.project;
  const square = group === 'p4' || group === 'p4m' || group === 'p4g';
  const triangular =
    group === 'p3' || group === 'p3m1' || group === 'p31m' || group === 'p6' || group === 'p6m';
  const cellHeight = square
    ? current.cellWidth
    : triangular
      ? Math.round((Math.sqrt(3) / 2) * current.cellWidth)
      : current.cellHeight;
  const candidate: Project = {
    ...structuredClone(current),
    group,
    cellHeight
  };
  const issues = validateColorConfig(group, candidate.colorConfig);
  const targetSymbols = new Set(GROUP_SPECS[group].generators.map((generator) => generator.symbol));
  for (const [symbol, permutation] of Object.entries(current.colorConfig.generatorPermutations)) {
    if (targetSymbols.has(symbol)) continue;
    const nonIdentity = Object.entries(permutation).some(([source, target]) => source !== target);
    if (nonIdentity) {
      issues.push({
        symbol,
        message: `新群没有生成元 ${symbol}，但已保存的非恒等角色置换无法在 ${group} 中表达。`
      });
    }
  }
  if (issues.length > 0) {
    const conflict = `不能切换到 ${group}：当前色彩角色映射不满足新群关系。已保留现有工程和映射。${issues
      .map((issue) => issue.message)
      .join(' ')}`;
    editorStore.update((s) => ({ ...s, colorConflict: conflict }));
    return false;
  }

  updateProject(() => candidate);
  editorStore.update((s) => ({ ...s, selectedInstance: null, selectedRoleId: null }));
  return true;
}

export function setCellSize(width: number, height: number) {
  updateProject((project) => {
    const next = {
      ...project,
      cellWidth: Math.max(40, Math.round(width)),
      cellHeight: Math.max(40, Math.round(height))
    };
    return { ...next, colorSupercell: deriveColorSupercell(next.group, next.cellWidth, next.cellHeight, next.colorConfig) };
  });
}

export function updateColorConfig(mutator: (config: ColorConfig) => ColorConfig): boolean {
  const state = get(editorStore);
  const candidateConfig = mutator(structuredClone(state.project.colorConfig));
  const issues = validateColorConfig(state.project.group, candidateConfig);
  if (issues.length > 0) {
    editorStore.update((s) => ({
      ...s,
      colorConflict: `配置已拒绝：${issues.map((issue) => issue.message).join(' ')}`
    }));
    return false;
  }
  pushHistory();
  editorStore.update((s) => {
    const project = {
      ...s.project,
      colorConfig: candidateConfig,
      colorSupercell: deriveColorSupercell(s.project.group, s.project.cellWidth, s.project.cellHeight, candidateConfig)
    };
    return { ...s, project, saved: false, colorConflict: null };
  });
  return true;
}

export function addColorRole(): boolean {
  return updateColorConfig((config) => {
    const count = config.roles.length;
    const role = {
      id: `role-${Date.now().toString(36)}-${count}`,
      name: `角色 ${count}`,
      fill: '#7c3aed',
      stroke: '#2e1065',
      opacity: null
    };
    const roles = [...config.roles, role];
    const generatorPermutations = Object.fromEntries(
      Object.entries(config.generatorPermutations).map(([symbol, map]) => [symbol, { ...map, [role.id]: role.id }])
    );
    return { roles, generatorPermutations };
  });
}

export function updateColorRole(roleId: string, patch: Partial<Omit<ColorConfig['roles'][number], 'id'>>): boolean {
  return updateColorConfig((config) => ({
    ...config,
    roles: config.roles.map((role) => (role.id === roleId ? { ...role, ...patch } : role))
  }));
}

export function deleteColorRole(roleId: string): boolean {
  if (roleId === identityColorRole().id) return false;
  return updateColorConfig((config) => {
    const roles = config.roles.filter((role) => role.id !== roleId);
    const generatorPermutations = Object.fromEntries(
      Object.entries(config.generatorPermutations).map(([symbol, map]) => {
        // Collapsing the removed role through its successor keeps the restriction a bijection.
        const successor = map[roleId];
        const nextMap = Object.fromEntries(
          roles.map((role) => [role.id, map[role.id] === roleId ? successor : (map[role.id] ?? role.id)]) as Array<[string, string]>
        );
        return [symbol, nextMap];
      })
    );
    return { roles, generatorPermutations };
  });
}

export function setGeneratorRole(symbol: string, sourceRoleId: string, targetRoleId: string): boolean {
  return updateColorConfig((config) => ({
    ...config,
    generatorPermutations: {
      ...config.generatorPermutations,
      [symbol]: {
        ...config.generatorPermutations[symbol],
        [sourceRoleId]: targetRoleId
      }
    }
  }));
}

export function applyColorPreset(config: ColorConfig): boolean {
  return updateColorConfig(() => config);
}

export function clearColorConflict() {
  editorStore.update((state) => ({ ...state, colorConflict: null }));
}

export function addObject(item: PatternObject, select = true) {
  pushHistory();
  editorStore.update((state) => ({
    ...state,
    project: { ...state.project, objects: [...state.project.objects, cloneObject(item)] },
    selectedId: select ? item.id : state.selectedId,
    selectedInstance: select ? null : state.selectedInstance,
    selectedRoleId: select ? null : state.selectedRoleId
  }));
}

export function updateSelectedObject(mutator: (item: PatternObject) => PatternObject, record = true) {
  updateProject((project) => {
    const objects = project.objects.map((item) => (item.id === get(editorStore).selectedId ? mutator(item) : item));
    return { ...project, objects };
  }, record);
}

export function updateObjectGeometry(id: string, path: PatternObject['path'], record = false) {
  updateProject((project) => ({
    ...project,
    objects: project.objects.map((item) => (item.id === id ? { ...item, path } : item))
  }), record);
}

export function deleteSelected() {
  updateProject((project) => ({
    ...project,
    objects: project.objects.filter((item) => item.id !== get(editorStore).selectedId)
  }));
  editorStore.update((state) => ({ ...state, selectedId: null, selectedInstance: null, selectedRoleId: null }));
}

export function markSaved() {
  editorStore.update((state) => ({ ...state, saved: true }));
}

export const renderOptions = writable<RenderOptions>({
  showDomain: true,
  showGrid: true,
  showSymmetry: true,
  showHandles: true
});

export const editor = editorStore;
