import assert from 'node:assert/strict';
import { GROUP_LIST, compose, identity, invert, multiply, reflectionX, reflectionY, translation } from '../src/lib/groups';
import type { mat3 } from 'gl-matrix';

type Token = { symbol: string; inverse: boolean };
const t = (symbol: string): Token => ({ symbol, inverse: false });
const ti = (symbol: string): Token => ({ symbol, inverse: true });
const powers = (symbol: string, count: number): Token[] =>
  Array.from({ length: count }, () => ({ symbol, inverse: false }));

const words: Record<string, Token[][]> = {
  r2: [[], [t('r')]],
  m: [[], [t('m')]],
  g: [[], [t('g')]],
  mxmy: [[], [t('mₓ')], [t('m_y')], [t('mₓ'), t('m_y')]],
  myg: [[], [t('m_y')], [t('g')], [t('m_y'), t('g')]],
  r4: powersWords('r₄', 4),
  r4s: [...powersWords('r₄', 4), ...powersWords('r₄', 4).map((word) => [...word, t('s')])],
  r3: powersWords('r₃', 3),
  r3s: [...powersWords('r₃', 3), ...powersWords('r₃', 3).map((word) => [...word, t('s')])],
  r6: powersWords('r₆', 6),
  r6s: [...powersWords('r₆', 6), ...powersWords('r₆', 6).map((word) => [...word, t('s')])]
};

function powersWords(symbol: string, count: number): Token[][] {
  return Array.from({ length: count }, (_, index) => Array.from({ length: index }, () => t(symbol)));
}

const relators: Record<string, Token[][]> = {
  p1: [[t('t₂'), t('t₁'), ti('t₂'), ti('t₁')]],
  p2: [
    [t('r'), t('r')],
    [t('r'), t('t₁'), t('r'), t('t₁')],
    [t('r'), t('t₂'), t('r'), t('t₂')],
    [t('t₂'), t('t₁'), ti('t₂'), ti('t₁')]
  ],
  pm: [
    [t('m'), t('m')],
    [t('m'), t('t₁'), t('m'), t('t₁')],
    [t('m'), t('t₂'), t('m'), ti('t₂')],
    [t('t₂'), t('t₁'), ti('t₂'), ti('t₁')]
  ],
  pg: [
    [t('g'), t('g'), ti('t₁')],
    [t('g'), t('t₂'), ti('g'), t('t₂')],
    [t('t₂'), t('t₁'), ti('t₂'), ti('t₁')]
  ],
  cm: [
    [t('m'), t('m')],
    [t('m'), t('t₁'), t('m'), ti('t₂')],
    [t('t₂'), t('t₁'), ti('t₂'), ti('t₁')]
  ],
  pmm: [
    [t('mₓ'), t('mₓ')], [t('m_y'), t('m_y')],
    [t('mₓ'), t('m_y'), t('mₓ'), t('m_y')],
    [t('mₓ'), t('t₁'), t('mₓ'), ti('t₁')],
    [t('m_y'), t('t₂'), t('m_y'), ti('t₂')],
    [t('t₂'), t('t₁'), ti('t₂'), ti('t₁')]
  ],
  pmg: [
    [t('m_y'), t('m_y')], [t('g'), t('g'), ti('t₁')],
    [t('m_y'), t('g'), t('m_y'), t('g')],
    [t('g'), t('t₂'), ti('g'), t('t₂')],
    [t('t₂'), t('t₁'), ti('t₂'), ti('t₁')]
  ],
  cmm: [
    [t('mₓ'), t('mₓ')], [t('m_y'), t('m_y')],
    [t('mₓ'), t('m_y'), t('mₓ'), t('m_y')],
    [t('mₓ'), t('t₁'), t('mₓ'), t('t₂')],
    [t('m_y'), t('t₁'), t('m_y'), ti('t₂')],
    [t('t₂'), t('t₁'), ti('t₂'), ti('t₁')]
  ],
  p4: [
    powers('r₄', 4),
    [t('r₄'), t('t₁'), ti('r₄'), ti('t₂')],
    [t('r₄'), t('t₂'), ti('r₄'), t('t₁')],
    [t('t₂'), t('t₁'), ti('t₂'), ti('t₁')]
  ],
  p4m: [
    powers('r₄', 4), [t('s'), t('s')],
    [t('s'), t('r₄'), t('s'), t('r₄')],
    [t('r₄'), t('t₁'), ti('r₄'), ti('t₂')],
    [t('r₄'), t('t₂'), ti('r₄'), t('t₁')]
  ],
  p4g: [
    powers('r₄', 4), [t('s'), t('s')],
    [t('s'), t('r₄'), t('s'), t('r₄')],
    [t('r₄'), t('t₁'), ti('r₄'), ti('t₂')],
    [t('r₄'), t('t₂'), ti('r₄'), t('t₁')]
  ],
  p3: [
    powers('r₃', 3),
    [t('r₃'), t('t₁'), ti('r₃'), ti('t₂'), t('t₁')],
    [t('r₃'), t('t₂'), ti('r₃'), t('t₁')],
    [t('t₂'), t('t₁'), ti('t₂'), ti('t₁')]
  ],
  p3m1: [
    powers('r₃', 3), [t('s'), t('s')],
    [t('s'), t('r₃'), t('s'), t('r₃')],
    [t('s'), t('t₁'), t('s'), ti('t₁')],
    [t('s'), t('t₂'), t('s'), ti('t₁'), t('t₂')]
  ],
  p31m: [
    powers('r₃', 3), [t('s'), t('s')],
    [t('s'), t('r₃'), t('s'), t('r₃')],
    [t('s'), t('t₁'), t('s'), ti('t₂')],
    [t('s'), t('t₂'), t('s'), ti('t₁')]
  ],
  p6: [
    powers('r₆', 6),
    [t('r₆'), t('t₁'), ti('r₆'), ti('t₂')],
    [t('r₆'), t('t₂'), ti('r₆'), ti('t₂'), t('t₁')],
    [t('t₂'), t('t₁'), ti('t₂'), ti('t₁')]
  ],
  p6m: [
    powers('r₆', 6), [t('s'), t('s')],
    [t('s'), t('r₆'), t('s'), t('r₆')],
    [t('s'), t('t₁'), t('s'), ti('t₂')],
    [t('s'), t('t₂'), t('s'), ti('t₁')]
  ]
};

for (const spec of GROUP_LIST) {
  const w = 240;
  const square = spec.id === 'p4' || spec.id === 'p4m' || spec.id === 'p4g';
  const triangular = spec.id === 'p3' || spec.id === 'p3m1' || spec.id === 'p31m' || spec.id === 'p6' || spec.id === 'p6m';
  const h = square ? w : triangular ? (Math.sqrt(3) / 2) * w : 200;
  const matrices = Object.fromEntries(spec.generators.map((generator) => [generator.symbol, generator.matrix(w, h)]));
  const residual = (matrix: mat3) => {
    const id = identity();
    let result = 0;
    for (let i = 0; i < 8; i += 1) result = Math.max(result, Math.abs(matrix[i]! - id[i]!));
    return result;
  };
  for (const word of relators[spec.id] ?? []) {
    const matrix = word.reduce<mat3>((result, token) => {
      const base = matrices[token.symbol]!;
      return compose(result, token.inverse ? invert(base) : base);
    }, identity());
    assert.ok(residual(matrix) < 1e-5, `${spec.id} relator ${word.map((x) => x.symbol).join(' ')} residual ${residual(matrix)}`);
  }
}
console.log('✓ every finite color relator is also an affine group relation');
