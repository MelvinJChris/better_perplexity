/** Marks a pipeline stage that is stubbed. Real implementations land in later issues. */
export function notImplemented(name: string): never {
  throw new Error(`${name} is not implemented yet`);
}
