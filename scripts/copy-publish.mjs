import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const source = 'dist/inventario/browser';
const staging = join(tmpdir(), `inventario-publish-${process.pid}`);

rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
cpSync(source, staging, { recursive: true });

for (const name of readdirSync(staging)) {
  cpSync(join(staging, name), join('dist', name), { recursive: true });
}

rmSync(staging, { recursive: true, force: true });
