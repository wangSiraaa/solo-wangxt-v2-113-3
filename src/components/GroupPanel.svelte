<script lang="ts">
  import { GROUP_LIST, GROUP_SPECS, getCellSize, matrixRows } from '../lib/groups';
  import { checkRelations, translationCoverage } from '../lib/verifier';
  import {
    addColorRole,
    applyColorPreset,
    clearColorConflict,
    deleteColorRole,
    editor,
    setCellSize,
    setGroup,
    setGeneratorRole,
    updateColorRole
  } from '../lib/stores';
  import {
    IDENTITY_ROLE_ID,
    colorRelatorLabels,
    p4mFourColorConfig,
    pgGlideColorConfig,
    validateColorConfig
  } from '../lib/color';
  import type { GroupId } from '../types';

  let showMatrices = false;

  $: project = $editor.project;
  $: [cellW, cellH] = getCellSize(project.group, project.cellWidth, project.cellHeight);
  $: spec = GROUP_SPECS[project.group as GroupId];
  $: checks = checkRelations(project.group, cellW, cellH);
  $: coverage = translationCoverage(project.group, cellW, cellH);
  $: colorIssues = validateColorConfig(project.group, project.colorConfig);
  $: colorIssueSymbols = new Set(colorIssues.map((issue) => issue.symbol));

  function chooseGroup(event: Event) {
    const target = event.currentTarget as HTMLSelectElement;
    const next = target.value as GroupId;
    if (!setGroup(next)) target.value = project.group;
  }

  function changeGenerator(symbol: string, sourceRoleId: string, event: Event) {
    const target = event.currentTarget as HTMLSelectElement;
    if (!setGeneratorRole(symbol, sourceRoleId, target.value)) target.value = sourceRoleId;
  }

  function roleColor(roleId: string, field: 'fill' | 'stroke', event: Event) {
    updateColorRole(roleId, { [field]: (event.currentTarget as HTMLInputElement).value });
  }

  function setRolePaintMode(roleId: string, field: 'fill' | 'stroke', event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    updateColorRole(roleId, { [field]: value === 'transparent' ? 'transparent' : value === 'inherit' ? null : roleColorValue(roleId, field) });
  }

  function roleColorValue(roleId: string, field: 'fill' | 'stroke') {
    return $editor.project.colorConfig.roles.find((role) => role.id === roleId)?.[field] ?? (field === 'fill' ? '#ffffff' : '#0f172a');
  }

  function rolePaintMode(role: { fill: string | null; stroke: string | null }, field: 'fill' | 'stroke'): string {
    const value = role[field];
    if (value === null) return 'inherit';
    if (value === 'transparent') return 'transparent';
    return 'custom';
  }

  function roleOpacity(roleId: string, event: Event) {
    updateColorRole(roleId, { opacity: Number((event.currentTarget as HTMLInputElement).value) });
  }

  function toggleInheritedStyle(roleId: string, inherit: boolean) {
    updateColorRole(roleId, { opacity: inherit ? null : 1 });
  }

  function renameRole(roleId: string, event: Event) {
    updateColorRole(roleId, { name: (event.currentTarget as HTMLInputElement).value });
  }

  $: square = project.group === 'p4' || project.group === 'p4m' || project.group === 'p4g';
  $: triangular =
    project.group === 'p3' ||
    project.group === 'p3m1' ||
    project.group === 'p31m' ||
    project.group === 'p6' ||
    project.group === 'p6m';
</script>

<section class="panel">
  <h3>墙纸群与生成元</h3>
  <label class="group-select">
    群
    <select value={project.group} on:change={chooseGroup}>
      {#each GROUP_LIST as group}
        <option value={group.id}>{group.name}</option>
      {/each}
    </select>
  </label>
  {#if $editor.colorConflict}
    <div class="conflict" role="alert">
      <strong>角色关系冲突</strong>
      <p>{$editor.colorConflict}</p>
      <button on:click={clearColorConflict}>知道了</button>
    </div>
  {/if}
  <p class="description">
    {spec.crystalName} · 常规单元 {Math.round(cellW)} × {Math.round(cellH)} · 每原胞 {spec.order} 个轨道像
  </p>

  <div class="sizes">
    <label>
      宽
      <input
        type="number"
        min="60"
        value={project.cellWidth}
        on:change={(e) => setCellSize(Number(e.currentTarget.value), project.cellHeight)}
      />
    </label>
    <label>
      高
      <input
        type="number"
        min="60"
        value={project.cellHeight}
        disabled={square || triangular}
        on:change={(e) => setCellSize(project.cellWidth, Number(e.currentTarget.value))}
      />
    </label>
  </div>
  {#if triangular}
    <p class="note">三角晶格高度锁定为 √3/2 × 宽度。</p>
  {/if}
  {#if square}
    <p class="note">正方形晶格高度锁定为宽度。</p>
  {/if}

  <div class="color-block">
    <div class="section-title">
      <h4>色彩角色群</h4>
      <div class="preset-buttons">
        {#if project.group === 'p4m'}
          <button on:click={() => applyColorPreset(p4mFourColorConfig())}>旋转四色预设</button>
        {/if}
        {#if project.group === 'pg'}
          <button on:click={() => applyColorPreset(pgGlideColorConfig())}>滑移双色预设</button>
        {/if}
        <button on:click={addColorRole}>新增角色</button>
      </div>
    </div>
    <p class="note">
      原始对象仍只有一个 ID；填充、描边、透明度由这里的有限角色和生成元置换推导。选择“继承”即使用对象基础样式。
    </p>
    <div class="roles">
      {#each project.colorConfig.roles as role (role.id)}
        <div class="role-card">
          <div class="role-head">
            <input value={role.name} on:change={(event) => renameRole(role.id, event)} />
            {#if role.id !== IDENTITY_ROLE_ID}
              <button class="tiny danger" on:click={() => deleteColorRole(role.id)}>删除</button>
            {/if}
          </div>
          {#if role.id === IDENTITY_ROLE_ID}
            <p class="identity-note">恒等角色：实例默认继承源对象的基础填充、描边和透明度。</p>
          {:else}
            <div class="role-style">
              <label>填充
                <select value={rolePaintMode(role, 'fill')}
                  on:change={(event) => setRolePaintMode(role.id, 'fill', event)}>
                  <option value="inherit">继承</option>
                  <option value="transparent">透明</option>
                  <option value="custom">自定义</option>
                </select>
                <input type="color" value={role.fill === 'transparent' ? '#ffffff' : (role.fill ?? '#ffffff')}
                  disabled={role.fill === null || role.fill === 'transparent'}
                  on:input={(event) => roleColor(role.id, 'fill', event)} />
              </label>
              <label>描边
                <select value={rolePaintMode(role, 'stroke')}
                  on:change={(event) => setRolePaintMode(role.id, 'stroke', event)}>
                  <option value="inherit">继承</option>
                  <option value="transparent">透明</option>
                  <option value="custom">自定义</option>
                </select>
                <input type="color" value={role.stroke === 'transparent' ? '#0f172a' : (role.stroke ?? '#0f172a')}
                  disabled={role.stroke === null || role.stroke === 'transparent'}
                  on:input={(event) => roleColor(role.id, 'stroke', event)} />
              </label>
              <label class="inherit wide">
                <input type="checkbox" checked={role.opacity === null}
                  on:change={(event) => toggleInheritedStyle(role.id, event.currentTarget.checked)} />
                继承透明度
              </label>
              {#if role.opacity !== null}
                <input class="wide" type="range" min="0" max="1" step="0.01" value={role.opacity}
                  on:input={(event) => roleOpacity(role.id, event)} />
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <h5>生成元角色置换</h5>
    <div class="permutations">
      {#each spec.generators as generator}
        <details>
          <summary>
            <strong>{generator.symbol}</strong>
            {#if colorIssueSymbols.has(generator.symbol)}<span class="badge bad">冲突</span>{/if}
          </summary>
          <div class="perm-grid">
            {#each project.colorConfig.roles as sourceRole (sourceRole.id)}
              {@const targetId = project.colorConfig.generatorPermutations[generator.symbol]?.[sourceRole.id] ?? sourceRole.id}
              <label>
                <span>{sourceRole.name}</span>→
                <select value={targetId} on:change={(event) => changeGenerator(generator.symbol, sourceRole.id, event)}>
                  {#each project.colorConfig.roles as targetRole (targetRole.id)}
                    <option value={targetRole.id}>{targetRole.name}</option>
                  {/each}
                </select>
              </label>
            {/each}
          </div>
        </details>
      {/each}
    </div>

    <p class="supercell">
      颜色超胞：{project.colorSupercell.repeats[0]} × {project.colorSupercell.repeats[1]} 个矩形几何单元，
      {Math.round(project.colorSupercell.width)} × {Math.round(project.colorSupercell.height)} px。
      画布、命中定位和 PNG 导出共用此派生结果。
    </p>
  </div>

  <ul class="generators">
    {#each spec.generators as generator}
      <li>
        <strong>{generator.symbol}</strong>
        <span>{generator.name}：{generator.description}</span>
        {#if showMatrices}
          <pre>{matrixRows(generator.matrix(cellW, cellH)).join('\n')}</pre>
        {/if}
      </li>
    {/each}
  </ul>
  <p class="coverage">{coverage}</p>

  <h4>矩阵群关系验证</h4>
  <ul class="checks">
    {#each checks as check}
      <li class={check.residual < 1e-8 ? 'ok' : 'bad'}>
        <span>{check.residual < 1e-8 ? '✓' : '×'}</span>
        <code>{check.label}</code>
        <em>{check.residual.toExponential(1)}</em>
      </li>
    {/each}
  </ul>

  <h4>色彩角色关系验证</h4>
  <ul class="checks color-checks">
    {#each colorRelatorLabels(project.group) as relation}
      <li class={colorIssueSymbols.has(relation) ? 'bad' : 'ok'}>
        <span>{colorIssueSymbols.has(relation) ? '×' : '✓'}</span>
        <code>{relation}</code>
      </li>
    {/each}
  </ul>
  {#if colorIssues.length > 0}
    <ul class="color-messages">
      {#each colorIssues as issue}
        <li>{issue.message}</li>
      {/each}
    </ul>
  {/if}

  <ul class="relations">
    {#each spec.relations as relation}
      <li>{relation}</li>
    {/each}
  </ul>
  <button on:click={() => (showMatrices = !showMatrices)}>
    {showMatrices ? '隐藏矩阵数值' : '显示 gl-matrix 矩阵数值'}
  </button>
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  h3,
  h4,
  h5 {
    margin: 0;
  }
  h5 {
    font-size: 12px;
  }
  select,
  input {
    width: 100%;
  }
  .group-select {
    display: grid;
    gap: 4px;
  }
  .description,
  .note,
  .coverage,
  .supercell,
  .identity-note {
    margin: 0;
    color: #475569;
    font-size: 12px;
    line-height: 1.4;
  }
  .sizes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .conflict {
    display: grid;
    gap: 6px;
    padding: 9px;
    border: 1px solid #fecaca;
    border-radius: 8px;
    background: #fef2f2;
    color: #7f1d1d;
    font-size: 12px;
  }
  .conflict p {
    margin: 0;
    line-height: 1.45;
  }
  .conflict button {
    justify-self: start;
  }
  .color-block {
    display: grid;
    gap: 8px;
    padding: 9px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #f8fafc;
  }
  .section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .preset-buttons {
    display: flex;
    gap: 4px;
  }
  .tiny {
    padding: 3px 6px;
    font-size: 11px;
  }
  .roles {
    display: grid;
    gap: 6px;
  }
  .role-card {
    display: grid;
    gap: 6px;
    padding: 7px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: white;
  }
  .role-head {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px;
  }
  .role-style {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    align-items: center;
  }
  .role-style label,
  .perm-grid label {
    display: grid;
    gap: 5px;
    align-items: center;
    font-size: 12px;
  }
  .role-style label {
    grid-template-columns: 42px 1fr;
  }
  .role-style label.inherit,
  .role-style label.wide {
    grid-template-columns: auto 1fr;
  }
  .role-style input[type='color'] {
    height: 28px;
    padding: 0;
  }
  .role-style input[type='checkbox'] {
    width: auto;
  }
  .role-style input[type='range'] {
    grid-column: 1 / -1;
  }
  .role-style label.inherit {
    grid-template-columns: auto 1fr;
    gap: 4px;
  }
  .role-style .wide {
    grid-column: 1 / -1;
  }
  .permutations {
    display: grid;
    gap: 5px;
  }
  .permutations summary {
    cursor: pointer;
    font-size: 12px;
  }
  .perm-grid {
    display: grid;
    gap: 5px;
    padding: 7px 4px 2px;
  }
  .perm-grid label {
    grid-template-columns: 64px 20px 1fr;
  }
  .badge {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 5px;
    border-radius: 999px;
    font-size: 10px;
  }
  .badge.bad,
  .color-messages {
    color: #991b1b;
  }
  .generators,
  .checks,
  .relations,
  .color-messages {
    margin: 0;
    padding-left: 18px;
    display: grid;
    gap: 6px;
    font-size: 12px;
  }
  .generators li,
  .checks li {
    display: grid;
    gap: 2px;
  }
  pre {
    margin: 4px 0 0;
    padding: 6px;
    background: #0f172a;
    color: #bfdbfe;
    border-radius: 6px;
    overflow-x: auto;
  }
  .checks li {
    grid-template-columns: 20px 1fr auto;
    align-items: center;
  }
  .checks .ok {
    color: #166534;
  }
  .checks .bad {
    color: #991b1b;
  }
  .checks em {
    font-style: normal;
    color: #64748b;
  }
  .relations {
    color: #475569;
  }
</style>
