import type { ColorConfig, ColorRole, ColorSupercell, GroupId, PatternObject, Project, StyleSpec } from '../types';
import { GROUP_SPECS, getCellSize } from './groups';

export interface ColorValidationIssue {
  symbol: string;
  message: string;
}

type Token = { symbol: string; inverse: boolean };
type Relator = { label: string; tokens: Token[] };

export const IDENTITY_ROLE_ID = 'identity';

export function identityColorRole(): ColorRole {
  return { id: IDENTITY_ROLE_ID, name: '恒等角色', fill: null, stroke: null, opacity: null };
}

export function defaultColorConfig(): ColorConfig {
  return { roles: [identityColorRole()], generatorPermutations: {} };
}

/**
 * The finite point-group part of each coset representative. Translation factors
 * are supplied separately when deriving an instance role.
 */
export const COSET_WORDS: Record<GroupId, Token[][]> = {
  p1: [[]],
  p2: [[], [{ symbol: 'r', inverse: false }]],
  pm: [[], [{ symbol: 'm', inverse: false }]],
  pg: [[], [{ symbol: 'g', inverse: false }]],
  cm: [[], [{ symbol: 'm', inverse: false }]],
  pmm: [
    [],
    [{ symbol: 'mₓ', inverse: false }],
    [{ symbol: 'm_y', inverse: false }],
    [
      { symbol: 'mₓ', inverse: false },
      { symbol: 'm_y', inverse: false }
    ]
  ],
  pmg: [
    [],
    [{ symbol: 'm_y', inverse: false }],
    [{ symbol: 'g', inverse: false }],
    [
      { symbol: 'm_y', inverse: false },
      { symbol: 'g', inverse: false }
    ]
  ],
  cmm: [
    [],
    [{ symbol: 'mₓ', inverse: false }],
    [{ symbol: 'm_y', inverse: false }],
    [
      { symbol: 'mₓ', inverse: false },
      { symbol: 'm_y', inverse: false }
    ]
  ],
  p4: powers('r₄', 4),
  p4m: dihedralWords('r₄', 's', 4),
  p4g: dihedralWords('r₄', 's', 4),
  p3: powers('r₃', 3),
  p3m1: dihedralWords('r₃', 's', 3),
  p31m: dihedralWords('r₃', 's', 3),
  p6: powers('r₆', 6),
  p6m: dihedralWords('r₆', 's', 6)
};

function powers(symbol: string, count: number): Token[][] {
  return Array.from({ length: count }, (_, index) =>
    Array.from({ length: index }, () => ({ symbol, inverse: false }))
  );
}

function dihedralWords(rotation: string, reflection: string, count: number): Token[][] {
  const rotations = powers(rotation, count);
  const reflected = rotations.map((word) => [...word, { symbol: reflection, inverse: false }]);
  return [...rotations, ...reflected];
}

const T = (symbol: string): Token => ({ symbol, inverse: false });
const TI = (symbol: string): Token => ({ symbol, inverse: true });

function powerTokens(symbol: string, count: number, inverse = false): Token[] {
  return Array.from({ length: count }, () => ({ symbol, inverse }));
}

function relator(label: string, tokens: Token[]): Relator {
  return { label, tokens };
}

const COLOR_RELATORS: Record<GroupId, Relator[]> = {
  p1: [relator('t₂t₁t₂⁻¹t₁⁻¹ = 1', [T('t₂'), T('t₁'), TI('t₂'), TI('t₁')])],
  p2: [
    relator('r² = 1', [T('r'), T('r')]),
    relator('r t₁ r = t₁⁻¹', [T('r'), T('t₁'), T('r'), T('t₁')]),
    relator('r t₂ r = t₂⁻¹', [T('r'), T('t₂'), T('r'), T('t₂')]),
    relator('t₂t₁t₂⁻¹t₁⁻¹ = 1', [T('t₂'), T('t₁'), TI('t₂'), TI('t₁')])
  ],
  pm: [
    relator('m² = 1', [T('m'), T('m')]),
    relator('m t₁ m = t₁⁻¹', [T('m'), T('t₁'), T('m'), T('t₁')]),
    relator('m t₂ m t₂⁻¹ = 1', [T('m'), T('t₂'), T('m'), TI('t₂')]),
    relator('t₂t₁t₂⁻¹t₁⁻¹ = 1', [T('t₂'), T('t₁'), TI('t₂'), TI('t₁')])
  ],
  pg: [
    relator('g² = t₁', [T('g'), T('g'), TI('t₁')]),
    relator('g t₂ g⁻¹ = t₂⁻¹', [T('g'), T('t₂'), TI('g'), T('t₂')]),
    relator('t₂t₁t₂⁻¹t₁⁻¹ = 1', [T('t₂'), T('t₁'), TI('t₂'), TI('t₁')])
  ],
  cm: [
    relator('m² = 1', [T('m'), T('m')]),
    relator('m t₁ m = t₂', [T('m'), T('t₁'), T('m'), TI('t₂')]),
    relator('t₂t₁t₂⁻¹t₁⁻¹ = 1', [T('t₂'), T('t₁'), TI('t₂'), TI('t₁')])
  ],
  pmm: [
    relator('mₓ² = 1', [T('mₓ'), T('mₓ')]),
    relator('m_y² = 1', [T('m_y'), T('m_y')]),
    relator('mₓ m_y mₓ m_y = 1', [T('mₓ'), T('m_y'), T('mₓ'), T('m_y')]),
    relator('mₓ t₁ mₓ = t₁', [T('mₓ'), T('t₁'), T('mₓ'), TI('t₁')]),
    relator('m_y t₂ m_y = t₂', [T('m_y'), T('t₂'), T('m_y'), TI('t₂')]),
    relator('t₂t₁t₂⁻¹t₁⁻¹ = 1', [T('t₂'), T('t₁'), TI('t₂'), TI('t₁')])
  ],
  pmg: [
    relator('m_y² = 1', [T('m_y'), T('m_y')]),
    relator('g² = t₁', [T('g'), T('g'), TI('t₁')]),
    relator('m_y g m_y = g⁻¹', [T('m_y'), T('g'), T('m_y'), T('g')]),
    relator('g t₂ g⁻¹ = t₂⁻¹', [T('g'), T('t₂'), TI('g'), T('t₂')]),
    relator('t₂t₁t₂⁻¹t₁⁻¹ = 1', [T('t₂'), T('t₁'), TI('t₂'), TI('t₁')])
  ],
  cmm: [
    relator('mₓ² = 1', [T('mₓ'), T('mₓ')]),
    relator('m_y² = 1', [T('m_y'), T('m_y')]),
    relator('mₓ m_y mₓ m_y = 1', [T('mₓ'), T('m_y'), T('mₓ'), T('m_y')]),
    relator('mₓ t₁ mₓ = t₂⁻¹', [T('mₓ'), T('t₁'), T('mₓ'), T('t₂')]),
    relator('m_y t₁ m_y = t₂', [T('m_y'), T('t₁'), T('m_y'), TI('t₂')]),
    relator('t₂t₁t₂⁻¹t₁⁻¹ = 1', [T('t₂'), T('t₁'), TI('t₂'), TI('t₁')])
  ],
  p4: [
    relator('r₄⁴ = 1', powerTokens('r₄', 4)),
    relator('r₄t₁r₄⁻¹ = t₂', [T('r₄'), T('t₁'), TI('r₄'), TI('t₂')]),
    relator('r₄t₂r₄⁻¹ = t₁⁻¹', [T('r₄'), T('t₂'), TI('r₄'), T('t₁')]),
    relator('t₂t₁t₂⁻¹t₁⁻¹ = 1', [T('t₂'), T('t₁'), TI('t₂'), TI('t₁')])
  ],
  p4m: [
    relator('r₄⁴ = 1', powerTokens('r₄', 4)),
    relator('s² = 1', [T('s'), T('s')]),
    relator('s r₄ s = r₄⁻¹', [T('s'), T('r₄'), T('s'), T('r₄')]),
    relator('r₄t₁r₄⁻¹ = t₂', [T('r₄'), T('t₁'), TI('r₄'), TI('t₂')]),
    relator('r₄t₂r₄⁻¹ = t₁⁻¹', [T('r₄'), T('t₂'), TI('r₄'), T('t₁')])
  ],
  p4g: [
    relator('r₄⁴ = 1', powerTokens('r₄', 4)),
    relator('s² = 1', [T('s'), T('s')]),
    relator('s r₄ s = r₄⁻¹', [T('s'), T('r₄'), T('s'), T('r₄')]),
    relator('r₄t₁r₄⁻¹ = t₂', [T('r₄'), T('t₁'), TI('r₄'), TI('t₂')]),
    relator('r₄t₂r₄⁻¹ = t₁⁻¹', [T('r₄'), T('t₂'), TI('r₄'), T('t₁')])
  ],
  p3: [
    relator('r₃³ = 1', powerTokens('r₃', 3)),
    relator('r₃t₁r₃⁻¹ = t₂t₁⁻¹', [T('r₃'), T('t₁'), TI('r₃'), TI('t₂'), T('t₁')]),
    relator('r₃t₂r₃⁻¹ = t₁⁻¹', [T('r₃'), T('t₂'), TI('r₃'), T('t₁')]),
    relator('t₂t₁t₂⁻¹t₁⁻¹ = 1', [T('t₂'), T('t₁'), TI('t₂'), TI('t₁')])
  ],
  p3m1: [
    relator('r₃³ = 1', powerTokens('r₃', 3)),
    relator('s² = 1', [T('s'), T('s')]),
    relator('s r₃ s = r₃⁻¹', [T('s'), T('r₃'), T('s'), T('r₃')]),
    relator('s t₁ s = t₁', [T('s'), T('t₁'), T('s'), TI('t₁')]),
    relator('s t₂ s = t₁t₂⁻¹', [T('s'), T('t₂'), T('s'), TI('t₁'), T('t₂')])
  ],
  p31m: [
    relator('r₃³ = 1', powerTokens('r₃', 3)),
    relator('s² = 1', [T('s'), T('s')]),
    relator('s r₃ s = r₃⁻¹', [T('s'), T('r₃'), T('s'), T('r₃')]),
    relator('s t₁ s = t₂', [T('s'), T('t₁'), T('s'), TI('t₂')]),
    relator('s t₂ s = t₁', [T('s'), T('t₂'), T('s'), TI('t₁')])
  ],
  p6: [
    relator('r₆⁶ = 1', powerTokens('r₆', 6)),
    relator('r₆t₁r₆⁻¹ = t₂', [T('r₆'), T('t₁'), TI('r₆'), TI('t₂')]),
    relator('r₆t₂r₆⁻¹ = t₂t₁⁻¹', [T('r₆'), T('t₂'), TI('r₆'), TI('t₂'), T('t₁')]),
    relator('t₂t₁t₂⁻¹t₁⁻¹ = 1', [T('t₂'), T('t₁'), TI('t₂'), TI('t₁')])
  ],
  p6m: [
    relator('r₆⁶ = 1', powerTokens('r₆', 6)),
    relator('s² = 1', [T('s'), T('s')]),
    relator('s r₆ s = r₆⁻¹', [T('s'), T('r₆'), T('s'), T('r₆')]),
    relator('s t₁ s = t₂', [T('s'), T('t₁'), T('s'), TI('t₂')]),
    relator('s t₂ s = t₁', [T('s'), T('t₂'), T('s'), TI('t₁')])
  ]
};

export function colorRelatorLabels(group: GroupId): string[] {
  return COLOR_RELATORS[group].map((relator) => relator.label);
}

function normalizeColorRole(role: Partial<ColorRole>, index: number): ColorRole {
  return {
    id: typeof role.id === 'string' && role.id ? role.id : index === 0 ? IDENTITY_ROLE_ID : `role-${index}`,
    name: typeof role.name === 'string' && role.name ? role.name : `角色 ${index}`,
    fill: typeof role.fill === 'string' ? role.fill : null,
    stroke: typeof role.stroke === 'string' ? role.stroke : null,
    opacity: typeof role.opacity === 'number' && Number.isFinite(role.opacity) ? role.opacity : null
  };
}

export function sanitizeColorConfig(config: Partial<ColorConfig> | undefined, group: GroupId): ColorConfig {
  const rawRoles = Array.isArray(config?.roles) && config.roles.length > 0 ? config.roles : [identityColorRole()];
  const roles: ColorRole[] = [];
  for (const role of rawRoles) {
    const normalized = normalizeColorRole(role ?? {}, roles.length);
    if (!roles.some((existing) => existing.id === normalized.id)) roles.push(normalized);
  }
  if (!roles.some((role) => role.id === IDENTITY_ROLE_ID)) roles[0] = { ...roles[0]!, id: IDENTITY_ROLE_ID };

  const roleIds = new Set(roles.map((role) => role.id));
  const generatorPermutations: ColorConfig['generatorPermutations'] = {};
  for (const generator of GROUP_SPECS[group].generators) {
    const incoming = config?.generatorPermutations?.[generator.symbol] ?? {};
    const map: Record<string, string> = {};
    for (const role of roles) {
      const target = incoming[role.id];
      map[role.id] = target && roleIds.has(target) ? target : role.id;
    }
    generatorPermutations[generator.symbol] = map;
  }
  return { roles, generatorPermutations };
}

export function normalizeProject<T extends { group: GroupId; cellWidth: number; cellHeight: number }>(
  project: T & { colorConfig?: Partial<ColorConfig>; colorSupercell?: ColorSupercell }
): T & { colorConfig: ColorConfig; colorSupercell: ColorSupercell } {
  const sanitized = sanitizeColorConfig(project.colorConfig, project.group);
  const valid = validateColorConfig(project.group, sanitized).length === 0;
  const colorConfig = valid
    ? sanitized
    : {
        roles: sanitized.roles,
        generatorPermutations: Object.fromEntries(
          GROUP_SPECS[project.group].generators.map((generator) => [
            generator.symbol,
            identityPermutation(sanitized.roles)
          ])
        )
      };
  return {
    ...project,
    colorConfig,
    colorSupercell: deriveColorSupercell(project.group, project.cellWidth, project.cellHeight, colorConfig)
  };
}

export function validateColorConfig(group: GroupId, config: ColorConfig): ColorValidationIssue[] {
  const issues: ColorValidationIssue[] = [];
  const roles = config.roles;
  if (roles.length === 0) {
    issues.push({ symbol: IDENTITY_ROLE_ID, message: '至少需要一个恒等角色。' });
    return issues;
  }
  if (roles[0]?.id !== IDENTITY_ROLE_ID) {
    issues.push({ symbol: roles[0]?.id ?? 'role', message: '第一个角色必须是恒等角色。' });
  }
  const ids = new Set<string>();
  for (const role of roles) {
    if (ids.has(role.id)) issues.push({ symbol: role.id, message: '角色 ID 重复。' });
    ids.add(role.id);
    if (role.opacity !== null && (role.opacity < 0 || role.opacity > 1)) {
      issues.push({ symbol: role.id, message: '透明度必须位于 0 到 1。' });
    }
  }

  const actions: Record<string, Record<string, string>> = {};
  for (const generator of GROUP_SPECS[group].generators) {
    const map: Record<string, string> = {};
    const targets = new Set<string>();
    const incoming = config.generatorPermutations[generator.symbol] ?? {};
    for (const role of roles) {
      const target = incoming[role.id] ?? role.id;
      if (!ids.has(target)) {
        issues.push({ symbol: generator.symbol, message: `置换指向了不存在的角色：${target}` });
        continue;
      }
      if (targets.has(target)) {
        issues.push({ symbol: generator.symbol, message: `${generator.symbol} 的角色映射必须是有限角色集合上的双射。` });
      }
      targets.add(target);
      map[role.id] = target;
    }
    actions[generator.symbol] = map;
  }

  const applyToken = (roleId: string, token: Token): string => {
    const map = actions[token.symbol];
    if (!map) return roleId;
    if (!token.inverse) return map[roleId] ?? roleId;
    return Object.entries(map).find(([, value]) => value === roleId)?.[0] ?? roleId;
  };

  for (const relator of COLOR_RELATORS[group]) {
    for (const role of roles) {
      const result = relator.tokens.reduce((current, token) => applyToken(current, token), role.id);
      if (result !== role.id) {
        issues.push({
          symbol: relator.label,
          message: `关系 ${relator.label} 未满足：角色「${role.name}」最终到达「${roles.find((candidate) => candidate.id === result)?.name ?? result}」。`
        });
        break;
      }
    }
  }
  return issues;
}

export function colorValidationSummary(group: GroupId, config: ColorConfig): string[] {
  return validateColorConfig(group, config).map((issue) => issue.message);
}

function applySymbol(config: ColorConfig, roleId: string, symbol: string, inverse = false): string {
  const map = config.generatorPermutations[symbol];
  if (!map) return roleId;
  if (!inverse) return map[roleId] ?? roleId;
  return Object.entries(map).find(([, value]) => value === roleId)?.[0] ?? roleId;
}

function permutationOrder(config: ColorConfig, symbols: Token[]): number {
  let order = 1;
  for (const role of config.roles) {
    let current = role.id;
    for (let step = 1; step <= config.roles.length; step += 1) {
      current = symbols.reduce((value, token) => applySymbol(config, value, token.symbol, token.inverse), current);
      if (current === role.id) {
        order = leastCommonMultiple(order, step);
        break;
      }
    }
  }
  return order;
}

function leastCommonMultiple(a: number, b: number): number {
  return Math.abs(a * b) / greatestCommonDivisor(a, b);
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

function isTriangular(group: GroupId): boolean {
  return group === 'p3' || group === 'p3m1' || group === 'p31m' || group === 'p6' || group === 'p6m';
}

function isCentered(group: GroupId): boolean {
  return group === 'cm' || group === 'cmm';
}

export function deriveColorSupercell(
  group: GroupId,
  cellWidth: number,
  cellHeight: number,
  config: ColorConfig
): ColorSupercell {
  const [cellW, cellH] = getCellSize(group, cellWidth, cellHeight);
  let repeatX = 1;
  let repeatY = 1;
  if (isTriangular(group)) {
    repeatX = permutationOrder(config, [T('t₁'), T('t₁')]);
    repeatY = permutationOrder(config, [TI('t₁'), T('t₂'), T('t₂')]);
  } else if (isCentered(group)) {
    repeatX = permutationOrder(config, [T('t₁'), TI('t₂')]);
    repeatY = permutationOrder(config, [T('t₁'), T('t₂')]);
  } else {
    repeatX = permutationOrder(config, [T('t₁')]);
    repeatY = permutationOrder(config, [T('t₂')]);
  }
  const baseCells: [number, number] = isTriangular(group) ? [2, 2] : [1, 1];
  const baseWidth = isTriangular(group) ? cellW * 2 : cellW;
  const baseHeight = isTriangular(group) ? cellH * 2 : cellH;
  return {
    baseCells,
    repeats: [repeatX, repeatY],
    width: Math.round(baseWidth * repeatX * 1000) / 1000,
    height: Math.round(baseHeight * repeatY * 1000) / 1000
  };
}

export function roleForInstance(project: Project, coset: number, n: number, m: number): string {
  const config = project.colorConfig;
  const word = COSET_WORDS[project.group][coset] ?? [];
  let roleId = IDENTITY_ROLE_ID;
  // Matrices are T(n,m) C; their color action is the same word order.
  for (let i = 0; i < n; i += 1) roleId = applySymbol(config, roleId, 't₁');
  for (let i = 0; i > n; i -= 1) roleId = applySymbol(config, roleId, 't₁', true);
  for (let i = 0; i < m; i += 1) roleId = applySymbol(config, roleId, 't₂');
  for (let i = 0; i > m; i -= 1) roleId = applySymbol(config, roleId, 't₂', true);
  for (const token of word) roleId = applySymbol(config, roleId, token.symbol, token.inverse);
  return roleId;
}

export function styleForRole(item: PatternObject, roleId: string, config: ColorConfig): StyleSpec {
  const role = config.roles.find((candidate) => candidate.id === roleId) ?? config.roles[0]!;
  return {
    fill: role.fill ?? item.fill,
    stroke: role.stroke ?? item.stroke,
    strokeWidth: item.strokeWidth,
    opacity: role.opacity ?? item.opacity
  };
}

function identityPermutation(roles: ColorRole[]): Record<string, string> {
  return Object.fromEntries(roles.map((role) => [role.id, role.id]));
}

export function p4mFourColorConfig(): ColorConfig {
  const roles: ColorRole[] = [
    { id: IDENTITY_ROLE_ID, name: '0°（基础）', fill: null, stroke: null, opacity: null },
    { id: 'role-90', name: '90°', fill: '#2563eb', stroke: '#172554', opacity: null },
    { id: 'role-180', name: '180°', fill: '#16a34a', stroke: '#052e16', opacity: null },
    { id: 'role-270', name: '270°', fill: '#f59e0b', stroke: '#451a03', opacity: null }
  ];
  const identity = identityPermutation(roles);
  return {
    roles,
    generatorPermutations: {
      't₁': identity,
      't₂': identity,
      'r₄': {
        [IDENTITY_ROLE_ID]: 'role-90',
        'role-90': 'role-180',
        'role-180': 'role-270',
        'role-270': IDENTITY_ROLE_ID
      },
      s: {
        [IDENTITY_ROLE_ID]: IDENTITY_ROLE_ID,
        'role-90': 'role-270',
        'role-180': 'role-180',
        'role-270': 'role-90'
      }
    }
  };
}

export function pgGlideColorConfig(): ColorConfig {
  const roles: ColorRole[] = [
    { id: IDENTITY_ROLE_ID, name: '原色', fill: null, stroke: null, opacity: null },
    { id: 'role-glide', name: '滑移色', fill: '#2563eb', stroke: '#172554', opacity: null }
  ];
  const identity = identityPermutation(roles);
  const swap = {
    [IDENTITY_ROLE_ID]: 'role-glide',
    'role-glide': IDENTITY_ROLE_ID
  };
  return {
    roles,
    generatorPermutations: {
      't₁': identity,
      't₂': swap,
      g: swap
    }
  };
}
