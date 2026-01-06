#!/usr/bin/env node
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';

// Read version from package.json (single source of truth)
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = pkg.version;

// Build with esbuild, injecting version
await build({
  entryPoints: ['scripts/statusline.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.js',
  define: {
    __VERSION__: JSON.stringify(version),
  },
});

console.log(`✓ Built dist/index.js with version ${version}`);

// Sync plugin.json
const pluginJson = JSON.parse(readFileSync('./.claude-plugin/plugin.json', 'utf-8'));
pluginJson.version = version;
writeFileSync('./.claude-plugin/plugin.json', JSON.stringify(pluginJson, null, 2) + '\n');

// Sync marketplace.json
const marketplaceJson = JSON.parse(readFileSync('./.claude-plugin/marketplace.json', 'utf-8'));
marketplaceJson.version = version;
if (marketplaceJson.metadata) {
  marketplaceJson.metadata.version = version;
}
writeFileSync('./.claude-plugin/marketplace.json', JSON.stringify(marketplaceJson, null, 2) + '\n');

console.log(`✓ Synced version ${version} to plugin.json and marketplace.json`);
