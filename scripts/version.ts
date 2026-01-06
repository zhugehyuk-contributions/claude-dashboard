/**
 * Plugin version - injected at build time via esbuild define
 * Falls back to 'dev' if not defined (during development)
 */
declare const __VERSION__: string;
export const VERSION: string = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';
