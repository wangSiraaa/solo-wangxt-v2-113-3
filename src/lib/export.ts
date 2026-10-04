import type { Project } from '../types';
import { GROUP_SPECS, getCellSize } from './groups';
import { applyMat3, instanceMatrix } from './render';
import { roleForInstance, styleForRole } from './color';
import { makePath2D, makePolygonPath } from './path';

export interface TileResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  repeats: [number, number];
  primitive: [number, number];
  colorRepeats: [number, number];
}

/**
 * Render a true rectangular periodic image. The rectangular geometric cell is
 * enlarged by the finite color translation subgroup so that the PNG is periodic
 * in both geometry and role. Like the canvas and hit tester, the pixels come from
 * matrix images of the source objects rather than copied color objects.
 */
export function exportPeriodicTile(project: Project, scale = 2): TileResult {
  const [cellW, cellH] = getCellSize(project.group, project.cellWidth, project.cellHeight);
  const spec = GROUP_SPECS[project.group];
  const triangular = project.colorSupercell.baseCells[0] === 2 && project.colorSupercell.baseCells[1] === 2;
  const repeatN = project.colorSupercell.repeats[0]!;
  const repeatM = project.colorSupercell.repeats[1]!;
  const width = project.colorSupercell.width;
  const height = project.colorSupercell.height;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  // Keep the exported tile transparent: deliberately do not paint a background.
  ctx.clearRect(0, 0, width, height);

  const cosetMatrices = spec.cosets(cellW, cellH);
  const domainPath = makePath2D(makePolygonPath(spec.domain(cellW, cellH)));
  const limit = Math.max(repeatN, repeatM);
  const range = triangular
    ? { nMin: -limit - 1, nMax: limit * 2 + 1, mMin: -limit - 1, mMax: limit * 2 + 1 }
    : { nMin: -1, nMax: repeatN, mMin: -1, mMax: repeatM };

  for (const item of project.objects) {
    const path = makePath2D(item.path);
    for (let coset = 0; coset < cosetMatrices.length; coset += 1) {
      for (let n = range.nMin; n <= range.nMax; n += 1) {
        for (let m = range.mMin; m <= range.mMax; m += 1) {
          ctx.save();
          applyMat3(ctx, instanceMatrix(project, coset, n + (triangular ? 1 : 0), m + (triangular ? 1 : 0)));
          ctx.beginPath();
          ctx.rect(0, 0, width, height);
          ctx.clip();
          ctx.clip(domainPath);
          const style = styleForRole(
            item,
            roleForInstance(project, coset, n + (triangular ? 1 : 0), m + (triangular ? 1 : 0)),
            project.colorConfig
          );
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
    repeats: project.colorSupercell.baseCells,
    primitive: [cellW, cellH],
    colorRepeats: [repeatN, repeatM]
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
