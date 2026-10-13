import {
  type ReconciliationSource,
  ReconciliationSources,
} from '../../application/ports/reconciliation-ports';

/** Built from configuration: a provider without its config has nothing to reconcile. */
export class ConfiguredReconciliationSources extends ReconciliationSources {
  constructor(private readonly sources: readonly ReconciliationSource[]) {
    super();
  }

  all(): readonly ReconciliationSource[] {
    return this.sources;
  }

  find(id: string): ReconciliationSource | undefined {
    return this.sources.find((s) => s.id === id);
  }
}
