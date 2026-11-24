import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

// Tests de regresión de la infraestructura de CI (no necesitan navegador).
// Verifican la estructura de los workflows de Pages y la detección de cambios.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflows = path.join(repoRoot, '.github', 'workflows');
const detectScript = path.join(repoRoot, '.github', 'scripts', 'detect-code-changes.sh');

const readWorkflow = (name) => readFileSync(path.join(workflows, name), 'utf8');

function runDetect(changedFiles) {
  return execFileSync('bash', [detectScript], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, CHANGED_FILES: changedFiles, GITHUB_OUTPUT: '' }
  });
}

test.describe('HDH-INFRA01 - CI: deploy de Pages y tests condicionales', () => {
  test('deploy-pages separa build y deploy (evita la carrera del artefacto)', () => {
    const yml = readWorkflow('deploy-pages.yml');

    expect(yml).toMatch(/^\s{2}build:\s*$/m);
    expect(yml).toMatch(/^\s{2}deploy:\s*$/m);
    expect(yml).toContain('needs: build');
    expect(yml).toContain('actions/upload-pages-artifact@v3');
    expect(yml).toContain('actions/deploy-pages@v4');
    expect(yml).toContain('group: github-pages-deploy');
  });

  test('weekly-data comparte el grupo de concurrencia y también separa build y deploy', () => {
    const yml = readWorkflow('weekly-data.yml');

    expect(yml).toContain('group: github-pages-deploy');
    expect(yml).not.toContain('github-pages-weekly-data');
    expect(yml).toMatch(/^\s{2}build:\s*$/m);
    expect(yml).toMatch(/^\s{2}deploy:\s*$/m);
    expect(yml).toContain('needs: build');
  });

  test('auto-merge condiciona Playwright a la detección de código pero siempre intenta mergear', () => {
    const yml = readWorkflow('auto-merge.yml');

    expect(yml).toContain('.github/scripts/detect-code-changes.sh');
    expect(yml).toMatch(/name: Detect whether the change touches code\s*\n\s*id: changes/);

    const guard = "if: steps.changes.outputs.code_changed == 'true'";
    for (const step of ['Setup Node', 'Install E2E dependencies', 'Install Playwright browsers', 'Start static site', 'Run E2E tests']) {
      const stepBlock = yml.split(`- name: ${step}`)[1];
      expect(stepBlock, `${step} debe estar condicionado`).toBeTruthy();
      expect(stepBlock.slice(0, 200)).toContain(guard);
    }

    const mergeBlock = yml.split('- name: Merge Pull Request')[1];
    expect(mergeBlock).toBeTruthy();
    expect(mergeBlock.slice(0, 200)).not.toContain('code_changed');
  });

  test('detect-code-changes omite tests en cambios solo de documentación', () => {
    expect(runDetect('PROGRESS.md')).toContain('code_changed=false');
    expect(runDetect('PROGRESS.md\nfeatures_list.json\nevidence/screenshots/x.png')).toContain('code_changed=false');
    expect(runDetect('README.md\nCHANGELOG.md\n.agents/skills/github-delivery/SKILL.md')).toContain('code_changed=false');
  });

  test('detect-code-changes exige tests cuando se toca código, tests o workflows', () => {
    expect(runDetect('src/app.js')).toContain('code_changed=true');
    expect(runDetect('src/data/heat-data.json')).toContain('code_changed=true');
    expect(runDetect('e2e/tests/HDH-INFRA01.spec.js')).toContain('code_changed=true');
    expect(runDetect('.github/workflows/deploy-pages.yml')).toContain('code_changed=true');
    expect(runDetect('scripts/player-colors.js')).toContain('code_changed=true');
    expect(runDetect('PROGRESS.md\nsrc/styles.css')).toContain('code_changed=true');
  });

  test('detect-code-changes escribe el output de GitHub Actions', () => {
    const outputFile = path.join(repoRoot, 'e2e', '.tmp-github-output');
    execFileSync('bash', [detectScript], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, CHANGED_FILES: 'PROGRESS.md', GITHUB_OUTPUT: outputFile },
      stdio: 'pipe'
    });
    const written = readFileSync(outputFile, 'utf8');
    expect(written).toContain('code_changed=false');
    expect(written).toContain('code_files<<EOF');
    execFileSync('bash', ['-c', `rm -f "${outputFile}"`]);
  });
});
