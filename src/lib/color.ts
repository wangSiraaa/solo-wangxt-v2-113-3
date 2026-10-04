import { uid } from './path';
import { GROUP_SPECS } from './groups';
import type { ColorRole, ColorScheme, GroupId, PatternObject, Project, StyleSpec } from '../types';

export const IDENTITY_ROLE_ID = 'identity';

type WordPart = [symbol: string, power?: number];
type Word = WordPart[];

const T1: WordPart = ['t₁'];
const T2: WordPart = ['t₂'];
const inv = (symbol: string): WordPart => [symbol, -1];
const W = (...parts: WordPart[]): Word => parts;

const ROLE_PALETTE: Array<Pick<ColorRole, 'fill' | 'stroke' | 'opacity'>> = [
  { fill: '#dc2626', stroke: '#450a0a', opacity: null },
  { fill: '#2563eb', stroke: '#172554', opacity: null },
  { fill: '#16a34a', stroke: '#052e16', opacity: null },
  { fill: '#d97706', stroke: '#451a03', opacity: null },
  { fill: '#7c3aed', stroke: '#2e1065', opacity: null },
  { fill: '#0891b2', stroke: '#083344', opacity: null }
];

export function identityColorScheme(group: GroupId): ColorScheme {
  const role: ColorRole = {
    id: IDENTITY_ROLE_ID,
    name: '恒等角色',
    fill: null,
    stroke: null,
    opacity: null
  };
  return {
    roles: [role],
    actions: Object.fromEntries(GROUP_SPECS[group].generators.map((generator) => [generator.symbol, [0]])),
    supercell: { n: 1, m: 1 }
  };
}

function uniqueRoleId(existing: Set<string>, index: number): string {
  let id = `role-${index}`;
  let suffix = 2;
  while (existing.has(id)) {
    id = `role-${index}-${suffix}`;
    suffix += 1;
  }
  existing.add(id);
  return id;
}

/**
 * Fill missing version fields without changing any visual data. An old project's one
 * role inherits every visual field from the same source object. No objects are copied or
 * restyled, so canvas and PNG output preserve legacy monochrome pixels.
 */
export function normalizeProject(project: Project): Project {
  if (project.colorScheme?.roles?.length) {
    const count = project.colorScheme.roles.length;
    const knownIds = new Set<string>();
    const roles = project.colorScheme.roles.map((role, index) => {
      let id = role.id || uniqueRoleId(knownIds, index + 1);
      if (knownIds.has(id)) id = uniqueRoleId(knownIds, index + 1);
      knownIds.add(id);
      return {
        id,
        name: role.name || `色彩角色 ${index + 1}`,
        fill: role.fill ?? null,
        stroke: role.stroke ?? null,
        opacity: role.opacity === undefined ? null : role.opacity
      };
    });
    const actions: Record<string, number[]> = {};
    for (const [symbol, permutation] of Object.entries(project.colorScheme.actions ?? {})) {
      actions[symbol] = Array.from({ length: count }, (_, index) => {
        const target = permutation?.[index];
        return typeof target === 'number' && target >= 0 && target < count ? target : index;
      });
    }
    for (const generator of GROUP_SPECS[project.group].generators) {
      actions[generator.symbol] ??= Array.from({ length: count }, (_, index) => index);
    }
    const validation = validateColorScheme(project.group, { roles, actions });
    return {
      ...project,
      colorScheme: {
        roles,
        actions,
        supercell: validation.valid
          ? validation.supercell
          : project.colorScheme.supercell ?? { n: 1, m: 1 }
      }
    };
  }

  return { ...project, colorScheme: identityColorScheme(project.group) };
}

function normalizePermutation(value: number[] | undefined, count: number): number[] {
  return Array.from({ length: count }, (_, index) => {
    const target = value?.[index];
    return typeof target === 'number' && target >= 0 && target < count ? target : index;
  });
}

export function prepareColorScheme(group: GroupId, scheme: ColorScheme): ColorScheme {
  const count = Math.max(1, scheme.roles.length);
  const roles = scheme.roles.slice(0, count);
  const actions: Record<string, number[]> = {};
  for (const generator of GROUP_SPECS[group].generators) {
    actions[generator.symbol] = normalizePermutation(scheme.actions[generator.symbol], count);
  }
  // Preserve foreign symbols in the rejected candidate so the conflict can name them;
  // callers never commit a candidate that fails validateColorScheme.
  for (const [symbol, permutation] of Object.entries(scheme.actions)) {
    actions[symbol] ??= normalizePermutation(permutation, count);
  }
  const validation = validateColorScheme(group, { roles, actions });
  return {
    roles,
    actions,
    supercell: validation.valid ? validation.supercell : scheme.supercell ?? { n: 1, m: 1 }
  };
}

function isPermutation(values: number[] | undefined, count: number): values is number[] {
  if (!values || values.length !== count) return false;
  const seen = new Set<number>();
  return values.every((value) => Number.isInteger(value) && value >= 0 && value < count && !seen.has(value) && seen.add(value).size > 0);
}

function inversePermutation(permutation: number[]): number[] {
  const inverse = Array.from({ length: permutation.length }, () => 0);
  permutation.forEach((target, source) => {
    inverse[target] = source;
  });
  return inverse;
}

function powerPermutation(permutation: number[], power: number): number[] {
  const count = permutation.length;
  const forward = power >= 0 ? permutation : inversePermutation(permutation);
  const result: number[] = [];
  for (let start = 0; start < count; start += 1) {
    let value = start;
    for (let i = 0; i < Math.abs(power); i += 1) value = forward[value]!;
    result[start] = value;
  }
  return result;
}

function permutationOrder(permutation: number[]): number {
  let order = 1;
  for (let start = 0; start < permutation.length; start += 1) {
    let length = 0;
    let value = start;
    do {
      value = permutation[value]!;
      length += 1;
    } while (value !== start && length <= permutation.length);
    order = lcm(order, length);
  }
  return order;
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function applyWord(actions: Record<string, number[]>, word: Word, role: number): number {
  let current = role;
  for (const [symbol, power = 1] of word) {
    const permutation = actions[symbol];
    if (!permutation) return current;
    current = powerPermutation(permutation, power)[current]!;
  }
  return current;
}

function wordsEqual(actions: Record<string, number[]>, left: Word, right: Word, count: number): boolean {
  for (let role = 0; role < count; role += 1) {
    if (applyWord(actions, left, role) !== applyWord(actions, right, role)) return false;
  }
  return true;
}

export interface ColorValidation {
  valid: boolean;
  errors: string[];
  supercell: { n: number; m: number };
}

function colorRelations(group: GroupId): Array<{ label: string; left: Word; right: Word }> {
  const relations: Array<{ label: string; left: Word; right: Word }> = [
    { label: 't₁t₂ = t₂t₁', left: W(T1, T2), right: W(T2, T1) }
  ];
  const add = (label: string, left: Word, right: Word) => relations.push({ label, left, right });

  switch (group) {
    case 'p1':
      break;
    case 'p2':
      add('r² = 1', W(['r', 2]), W());
      add('r t₁ r = t₁⁻¹', W(['r'], T1, ['r']), W(inv('t₁')));
      add('r t₂ r = t₂⁻¹', W(['r'], T2, ['r']), W(inv('t₂')));
      break;
    case 'pm':
      add('m² = 1', W(['m', 2]), W());
      add('m t₁ m = t₁⁻¹', W(['m'], T1, ['m']), W(inv('t₁')));
      add('m t₂ = t₂ m', W(['m'], T2), W(T2, ['m']));
      break;
    case 'pg':
      add('g² = t₁', W(['g', 2]), W(T1));
      add('g t₂ g = t₂', W(['g'], T2, ['g']), W(T2));
      break;
    case 'cm':
      add('m² = 1', W(['m', 2]), W());
      add('m t₁ m = t₂', W(['m'], T1, ['m']), W(T2));
      break;
    case 'pmm':
      add('mₓ² = 1', W(['mₓ', 2]), W());
      add('m_y² = 1', W(['m_y', 2]), W());
      add('(mₓm_y)² = 1', W(['mₓ'], ['m_y'], ['mₓ'], ['m_y']), W());
      add('mₓ t₁ mₓ = t₁⁻¹', W(['mₓ'], T1, ['mₓ']), W(inv('t₁')));
      add('mₓ t₂ = t₂ mₓ', W(['mₓ'], T2), W(T2, ['mₓ']));
      add('m_y t₁ = t₁ m_y', W(['m_y'], T1), W(T1, ['m_y']));
      add('m_y t₂ m_y = t₂⁻¹', W(['m_y'], T2, ['m_y']), W(inv('t₂')));
      break;
    case 'pmg':
      add('m_y² = 1', W(['m_y', 2]), W());
      add('g² = t₁', W(['g', 2]), W(T1));
      add('m_y g m_y = g⁻¹', W(['m_y'], ['g'], ['m_y']), W(inv('g')));
      add('m_y t₁ = t₁ m_y', W(['m_y'], T1), W(T1, ['m_y']));
      add('m_y t₂ m_y = t₂⁻¹', W(['m_y'], T2, ['m_y']), W(inv('t₂')));
      break;
    case 'cmm':
      add('mₓ² = 1', W(['mₓ', 2]), W());
      add('m_y² = 1', W(['m_y', 2]), W());
      add('mₓ t₁ mₓ = t₂⁻¹', W(['mₓ'], T1, ['mₓ']), W(inv('t₂')));
      add('mₓ t₂ mₓ = t₁⁻¹', W(['mₓ'], T2, ['mₓ']), W(inv('t₁')));
      add('m_y t₁ m_y = t₂', W(['m_y'], T1, ['m_y']), W(T2));
      add('m_y t₂ m_y = t₁', W(['m_y'], T2, ['m_y']), W(T1));
      break;
    case 'p4':
      add('r₄⁴ = 1', W(['r₄', 4]), W());
      add('r₄ t₁ r₄⁻¹ = t₂', W(['r₄'], T1, inv('r₄')), W(T2));
      add('r₄ t₂ r₄⁻¹ = t₁⁻¹', W(['r₄'], T2, inv('r₄')), W(inv('t₁')));
      break;
    case 'p4m':
      add('r₄⁴ = 1', W(['r₄', 4]), W());
      add('s² = 1', W(['s', 2]), W());
      add('r₄ t₁ r₄⁻¹ = t₂', W(['r₄'], T1, inv('r₄')), W(T2));
      add('r₄ t₂ r₄⁻¹ = t₁⁻¹', W(['r₄'], T2, inv('r₄')), W(inv('t₁')));
      add('s t₁ s = t₂', W(['s'], T1, ['s']), W(T2));
      add('s t₂ s = t₁', W(['s'], T2, ['s']), W(T1));
      add('s r₄ s = r₄⁻¹', W(['s'], ['r₄'], ['s']), W(inv('r₄')));
      break;
    case 'p4g':
      add('r₄⁴ = 1', W(['r₄', 4]), W());
      add('s² = 1', W(['s', 2]), W());
      add('r₄ t₁ r₄⁻¹ = t₂', W(['r₄'], T1, inv('r₄')), W(T2));
      add('r₄ t₂ r₄⁻¹ = t₁⁻¹', W(['r₄'], T2, inv('r₄')), W(inv('t₁')));
      add('s t₁ s = t₂', W(['s'], T1, ['s']), W(T2));
      add('s t₂ s = t₁', W(['s'], T2, ['s']), W(T1));
      add('(r₄s)² = 1', W(['r₄'], ['s'], ['r₄'], ['s']), W());
      add('s r₄ s = r₄⁻¹', W(['s'], ['r₄'], ['s']), W(inv('r₄')));
      break;
    case 'p3':
    case 'p3m1':
    case 'p31m':
      add('r₃³ = 1', W(['r₃', 3]), W());
      add('r₃ t₁ r₃⁻¹ = t₂t₁⁻¹', W(['r₃'], T1, inv('r₃')), W(T2, inv('t₁')));
      add('r₃ t₂ r₃⁻¹ = t₁⁻¹', W(['r₃'], T2, inv('r₃')), W(inv('t₁')));
      if (group !== 'p3') {
        add('s² = 1', W(['s', 2]), W());
        if (group === 'p3m1') {
          add('s t₁ s = t₁', W(['s'], T1, ['s']), W(T1));
          add('s t₂ s = t₁t₂⁻¹', W(['s'], T2, ['s']), W(T1, inv('t₂')));
        } else {
          add('s t₁ s = t₂', W(['s'], T1, ['s']), W(T2));
          add('s t₂ s = t₁', W(['s'], T2, ['s']), W(T1));
        }
        add('s r₃ s = r₃⁻¹', W(['s'], ['r₃'], ['s']), W(inv('r₃')));
      }
      break;
    case 'p6':
    case 'p6m':
      add('r₆⁶ = 1', W(['r₆', 6]), W());
      add('r₆ t₁ r₆⁻¹ = t₂', W(['r₆'], T1, inv('r₆')), W(T2));
      add('r₆ t₂ r₆⁻¹ = t₂t₁⁻¹', W(['r₆'], T2, inv('r₆')), W(T2, inv('t₁')));
      if (group === 'p6m') {
        add('s² = 1', W(['s', 2]), W());
        add('s t₁ s = t₂', W(['s'], T1, ['s']), W(T2));
        add('s t₂ s = t₁', W(['s'], T2, ['s']), W(T1));
        add('s r₆ s = r₆⁻¹', W(['s'], ['r₆'], ['s']), W(inv('r₆')));
      }
      break;
  }
  return relations;
}

export function validateColorScheme(group: GroupId, scheme: Pick<ColorScheme, 'roles' | 'actions'>): ColorValidation {
  const errors: string[] = [];
  const count = scheme.roles.length;
  const symbols = new Set(GROUP_SPECS[group].generators.map((generator) => generator.symbol));
  const actions: Record<string, number[]> = {};

  if (count === 0) errors.push('至少需要一个色彩角色。');
  for (const [symbol, permutation] of Object.entries(scheme.actions)) {
    if (!symbols.has(symbol)) {
      errors.push(`生成元 ${symbol} 不属于群 ${group}，不能保留该角色作用。`);
      continue;
    }
    if (!isPermutation(permutation, count)) errors.push(`生成元 ${symbol} 的角色作用必须是 ${count} 个角色上的双射。`);
    actions[symbol] = permutation;
  }
  for (const symbol of symbols) {
    if (!actions[symbol]) errors.push(`缺少生成元 ${symbol} 的角色作用。`);
  }
  for (const [index, role] of scheme.roles.entries()) {
    if (role.opacity !== null && (Number.isNaN(role.opacity) || role.opacity < 0 || role.opacity > 1)) {
      errors.push(`角色 ${role.name || index + 1} 的透明度必须位于 0 到 1。`);
    }
  }

  if (errors.length === 0) {
    for (const relation of colorRelations(group)) {
      if (!wordsEqual(actions, relation.left, relation.right, count)) {
        errors.push(`违反角色群关系：${relation.label}。`);
      }
    }
  }

  const t1 = actions['t₁'] ?? Array.from({ length: count }, (_, index) => index);
  const t2 = actions['t₂'] ?? Array.from({ length: count }, (_, index) => index);
  const supercell = { n: permutationOrder(t1), m: permutationOrder(t2) };
  return { valid: errors.length === 0, errors, supercell };
}

const COSET_WORDS: Record<GroupId, Word[]> = {
  p1: [W()],
  p2: [W(), W(['r'])],
  pm: [W(), W(['m'])],
  pg: [W(), W(['g'])],
  cm: [W(), W(['m'])],
  pmm: [W(), W(['mₓ']), W(['m_y']), W(['mₓ'], ['m_y'])],
  pmg: [W(), W(['m_y']), W(['g']), W(['m_y'], ['g'])],
  cmm: [W(), W(['mₓ']), W(['m_y']), W(['mₓ'], ['m_y'])],
  p4: [W(), W(['r₄']), W(['r₄', 2]), W(['r₄', 3])],
  p4m: [
    W(),
    W(['r₄']),
    W(['r₄', 2]),
    W(['r₄', 3]),
    W(['s']),
    W(['r₄'], ['s']),
    W(['r₄', 2], ['s']),
    W(['r₄', 3], ['s'])
  ],
  p4g: [
    W(),
    W(['r₄']),
    W(['r₄', 2]),
    W(['r₄', 3]),
    W(['s']),
    W(['r₄'], ['s']),
    W(['r₄', 2], ['s']),
    W(['r₄', 3], ['s'])
  ],
  p3: [W(), W(['r₃']), W(['r₃', 2])],
  p3m1: [W(), W(['r₃']), W(['r₃', 2]), W(['s']), W(['r₃'], ['s']), W(['r₃', 2], ['s'])],
  p31m: [W(), W(['r₃']), W(['r₃', 2]), W(['s']), W(['r₃'], ['s']), W(['r₃', 2], ['s'])],
  p6: [W(), W(['r₆']), W(['r₆', 2]), W(['r₆', 3]), W(['r₆', 4]), W(['r₆', 5])],
  p6m: [
    W(),
    W(['r₆']),
    W(['r₆', 2]),
    W(['r₆', 3]),
    W(['r₆', 4]),
    W(['r₆', 5]),
    W(['s']),
    W(['r₆'], ['s']),
    W(['r₆', 2], ['s']),
    W(['r₆', 3], ['s']),
    W(['r₆', 4], ['s']),
    W(['r₆', 5], ['s'])
  ]
};

export function instanceRoleIndex(project: Project, coset: number, n: number, m: number): number {
  const scheme = project.colorScheme ?? identityColorScheme(project.group);
  const words = COSET_WORDS[project.group];
  let role = 0;
  const apply = (symbol: string, power: number) => {
    const permutation = scheme.actions[symbol];
    if (permutation) role = powerPermutation(permutation, power)[role]!;
  };
  apply('t₁', n);
  apply('t₂', m);
  const word = words[coset] ?? W();
  for (const [symbol, power = 1] of word) apply(symbol, power);
  return role;
}

export function instanceRole(project: Project, coset: number, n: number, m: number): ColorRole {
  const scheme = project.colorScheme ?? identityColorScheme(project.group);
  return scheme.roles[instanceRoleIndex(project, coset, n, m)] ?? scheme.roles[0]!;
}

export function instanceStyle(project: Project, item: PatternObject, coset: number, n: number, m: number): StyleSpec {
  return resolvedObjectStyle(item, instanceRole(project, coset, n, m));
}

export function resolvedObjectStyle(item: PatternObject, role: ColorRole): StyleSpec {
  return {
    fill: role.fill ?? item.fill,
    stroke: role.stroke ?? item.stroke,
    strokeWidth: item.strokeWidth,
    opacity: role.opacity ?? item.opacity
  };
}

export function makeRole(count: number): ColorRole {
  const preset = ROLE_PALETTE[(count - 1) % ROLE_PALETTE.length]!;
  return {
    id: uid('role'),
    name: `色彩角色 ${count}`,
    fill: preset.fill,
    stroke: preset.stroke,
    opacity: preset.opacity
  };
}
