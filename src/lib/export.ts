import type { Project } from '../types';
import { GROUP_SPECS, getCellSize } from './groups';
import { instanceStyle } from './color';
import { applyMat3, instanceMatrix } from './render';
import { makePath2D, makePolygonPath } from './path';

export interface TileResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  repeats: [number, number];
  primitive: [number, number];
  colorSupercell: [number, number];
}

/**
 * Render the smallest rectangle used by both the geometry and the validated color
 * action. Rectangular groups start from one conventional cell; triangular groups use a
 * 2×2 primitive rectangle; each is multiplied by the derived translation supercell.
 * Fundamental domains are clipped as matrix images, including on transparent pixels.
 */
export function exportPeriodicTile(project: Project, scale = 2): TileResult {
  const [cellW, cellH] = getCellSize(project.group, project.cellWidth, project.cellHeight);
  const spec = GROUP_SPECS[project.group];
  const triangular =
    project.group === 'p3' ||
    project.group === 'p3m1' ||
    project.group === 'p31m' ||
    project.group === 'p6' ||
    project.group === 'p6m';
  const colorN = Math.max(1, project.colorScheme.supercell.n);
  const colorM = Math.max(1, project.colorScheme.supercell.m);
  const repeatN = (triangular ? 2 : 1) * colorN;
  const repeatM = (triangular ? 2 : 1) * colorM;
  const width = cellW * repeatN;
  const height = cellH * repeatM;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  // Keep the exported tile transparent: deliberately do not paint a background.
  ctx.clearRect(0, 0, width, height);

  const cosetMatrices = spec.cosets(cellW, cellH);
  const domainPath = makePath2D(makePolygonPath(spec.domain(cellW, cellH)));

  // A few extra neighboring primitive copies are needed only because some fundamental
  // domain coordinates (pm/pmg/cm) extend across the conventional rectangle's border.
  const range = {
    nMin: triangular ? 0 : -1,
    nMax: triangular ? repeatN + 1 : repeatN,
    mMin: triangular ? 0 : -1,
    mMax: triangular ? repeatM + 1 : repeatM
  };

  for (const item of project.objects) {
    const path = makePath2D(item.path);
    for (let coset = 0; coset < cosetMatrices.length; coset += 1) {
      for (let n = range.nMin; n <= range.nMax; n += 1) {
        for (let m = range.mMin; m <= range.mMax; m += 1) {
          const style = instanceStyle(project, item, coset, n, m);
          ctx.save();
          applyMat3(ctx, instanceMatrix(project, coset, n, m));
          ctx.beginPath();
          ctx.rect(0, 0, width, height);
          ctx.clip();
          ctx.clip(domainPath);
          ctx.globalAlpha = style.opacity;
          if (style.fill !== 'transparent') {
            ctx.fillStyle = style.fill;
            ctx.fill(path);
          }
          if (style.strokeWidth > 0) {
            ctx.strokeStyle = style.stroke;
            ctx.lineWidth = style.strokeWidth;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.stroke(path);
          }
          ctx.restore();
        }
      }
    }
  }
  return {
    canvas,
    width,
    height,
    repeats: [repeatN, repeatM],
    primitive: [cellW, cellH],
    colorSupercell: [colorN, colorM]
  };
}

export function downloadTile(project: Project, scale = 2) {
  const tile = exportPeriodicTile(project, scale);
  tile.canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/[^\p{L}\p{N}._-]+/gu, '-')}-${project.group}-tile.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
