<script lang="ts">
  import { GROUP_SPECS } from '../lib/groups';
  import {
    addColorRole,
    deleteColorRole,
    groupConflict,
    resetColorScheme,
    updateColorRole,
    updateColorScheme,
    editor
  } from '../lib/stores';
  import { makeRole, validateColorScheme } from './../lib/color';
  import type { ColorRole } from '../types';

  $: project = $editor.project;
  $: scheme = project.colorScheme;
  $: spec = GROUP_SPECS[project.group];
  $: validation = validateColorScheme(project.group, scheme);

  function setAction(symbol: string, sourceIndex: number, event: Event) {
    const targetElement = event.currentTarget as HTMLSelectElement;
    const target = Number(targetElement.value);
    const accepted = updateColorScheme((current) => ({
      ...current,
      actions: {
        ...current.actions,
        [symbol]: current.actions[symbol]!.map((value, index) => (index === sourceIndex ? target : value))
      }
    }));
    if (!accepted) targetElement.value = String(scheme.actions[symbol]?.[sourceIndex] ?? sourceIndex);
  }

  function patchRole(role: ColorRole, patch: Partial<ColorRole>) {
    updateColorRole(role.id, patch);
  }

  function applyPreset(kind: 'rotation4' | 'glide2') {
    const count = kind === 'rotation4' ? 4 : 2;
    const roles = Array.from({ length: count }, (_, index) => makeRole(index + 1));
    const identity = Array.from({ length: count }, (_, index) => index);
    const actions: Record<string, number[]> =
      kind === 'rotation4'
        ? {
            't₁': identity,
            't₂': [...identity],
            'r₄': [1, 2, 3, 0],
            s: [0, 3, 2, 1]
          }
        : {
            't₁': identity,
            't₂': [...identity],
            g: [1, 0]
          };
    updateColorScheme(() => ({ roles, actions, supercell: { n: 1, m: 1 } }));
  }
</script>

<section class="color-roles">
  <div class="heading">
    <h4>色彩角色群</h4>
    <div class="preset-buttons">
      {#if project.group === 'p4m'}
        <button on:click={() => applyPreset('rotation4')}>旋转四色预设</button>
      {/if}
      {#if project.group === 'pg'}
        <button on:click={() => applyPreset('glide2')}>滑移双色预设</button>
      {/if}
      <button on:click={addColorRole}>新增角色</button>
    </div>
  </div>
  <p class="note">
    源对象始终使用恒等角色；画布、命中定位和 PNG 只读取这里派生出的实例样式。颜色超胞：
    <strong>{validation.supercell.n} × {validation.supercell.m}</strong> 个平移周期。
  </p>

  <div class="roles">
    {#each scheme.roles as role, index (role.id)}
      <article class:identity={index === 0}>
        <header>
          <input class="name" value={role.name} on:change={(e) => patchRole(role, { name: e.currentTarget.value })} />
          {#if index !== 0}
            <button on:click={() => deleteColorRole(role.id)}>删除</button>
          {/if}
        </header>
        <div class="swatch-row">
          <label>
            <input
              type="checkbox"
              checked={role.fill !== null}
              on:change={(e) => patchRole(role, { fill: e.currentTarget.checked ? project.objects[0]?.fill ?? '#2563eb' : null })}
            />
            填充
            {#if role.fill !== null}
              <input type="color" value={role.fill} on:input={(e) => patchRole(role, { fill: e.currentTarget.value })} />
            {/if}
          </label>
          <label>
            <input
              type="checkbox"
              checked={role.stroke !== null}
              on:change={(e) => patchRole(role, { stroke: e.currentTarget.checked ? project.objects[0]?.stroke ?? '#0f172a' : null })}
            />
            描边
            {#if role.stroke !== null}
              <input type="color" value={role.stroke} on:input={(e) => patchRole(role, { stroke: e.currentTarget.value })} />
            {/if}
          </label>
          <label class="opacity">
            透明
            <input
              type="checkbox"
              checked={role.opacity !== null}
              on:change={(e) => patchRole(role, { opacity: e.currentTarget.checked ? 1 : null })}
            />
            {#if role.opacity !== null}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={role.opacity}
                on:input={(e) => patchRole(role, { opacity: Number(e.currentTarget.value) })}
              />
              <span>{Math.round(role.opacity * 100)}%</span>
            {/if}
          </label>
        </div>
        {#if index === 0}
          <p class="hint">取消勾选时继承对象基础样式；旧工程迁移到此状态，渲染和 PNG 不变。</p>
        {/if}
      </article>
    {/each}
  </div>

  <h5>各生成元的角色置换</h5>
  <div class="actions">
    {#each spec.generators as generator}
      <div class="generator">
        <strong>{generator.symbol}</strong>
        <div class="selects">
          {#each scheme.roles as role, sourceIndex (role.id)}
            <label>
              <span>{sourceIndex === 0 ? '恒等' : sourceIndex + 1}</span>
              <select value={scheme.actions[generator.symbol]?.[sourceIndex] ?? sourceIndex} on:change={(e) => setAction(generator.symbol, sourceIndex, e)}>
                {#each scheme.roles as target, targetIndex (target.id)}
                  <option value={targetIndex}>{targetIndex + 1} · {target.name}</option>
                {/each}
              </select>
            </label>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  {#if !validation.valid}
    <div class="error">
      {#each validation.errors as error}
        <p>✕ {error}</p>
      {/each}
    </div>
  {/if}
  {#if $groupConflict}
    <div class="error conflict"><p>{$groupConflict}</p></div>
  {/if}
  <button class="reset" on:click={resetColorScheme}>重置为单一恒等角色</button>
</section>

<style>
  .color-roles {
    display: grid;
    gap: 9px;
    border-top: 1px solid #e2e8f0;
    padding-top: 10px;
  }
  .heading,
  article header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .preset-buttons {
    display: flex;
    gap: 5px;
  }
  h4,
  h5 {
    margin: 0;
  }
  .note,
  .hint {
    margin: 0;
    color: #475569;
    font-size: 12px;
    line-height: 1.4;
  }
  .roles,
  .actions {
    display: grid;
    gap: 8px;
  }
  article {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 8px;
    display: grid;
    gap: 7px;
    background: #f8fafc;
  }
  article.identity {
    border-color: #93c5fd;
    background: #eff6ff;
  }
  .name {
    flex: 1;
  }
  .swatch-row {
    display: grid;
    gap: 6px;
  }
  .swatch-row label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  .swatch-row input[type='color'] {
    width: 42px;
    height: 26px;
    padding: 0;
  }
  .swatch-row input[type='range'] {
    flex: 1;
  }
  .generator {
    display: grid;
    gap: 5px;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    padding: 7px;
  }
  .selects {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5px;
  }
  .selects label {
    display: grid;
    grid-template-columns: 34px 1fr;
    align-items: center;
    gap: 4px;
    font-size: 12px;
  }
  .selects select {
    width: 100%;
    min-width: 0;
    font-size: 11px;
    padding: 3px;
  }
  .error {
    border: 1px solid #fecaca;
    background: #fef2f2;
    color: #991b1b;
    border-radius: 7px;
    padding: 7px;
    font-size: 12px;
    line-height: 1.35;
  }
  .error p {
    margin: 0;
  }
  .reset {
    border-color: #fecaca;
    background: #fff1f2;
    color: #991b1b;
  }
</style>
