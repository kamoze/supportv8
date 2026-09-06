export interface PortalLoadGuard {
  begin: () => () => boolean;
  invalidate: () => void;
}

export function createPortalLoadGuard(): PortalLoadGuard {
  let generation = 0;
  return {
    begin() {
      const currentGeneration = ++generation;
      return () => currentGeneration === generation;
    },
    invalidate() {
      generation += 1;
    },
  };
}
