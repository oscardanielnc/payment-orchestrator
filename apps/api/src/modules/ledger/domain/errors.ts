import { DomainError } from '../../../shared/domain/domain-error';

export class UnbalancedTransactionError extends DomainError {
  readonly code = 'ledger.unbalanced_transaction';

  constructor(currency: string, debits: bigint, credits: bigint) {
    super(
      `Ledger transaction does not balance in ${currency}: debits ${debits} ≠ credits ${credits}`,
    );
  }
}

export class InvalidLedgerEntryError extends DomainError {
  readonly code = 'ledger.invalid_entry';

  constructor(reason: string) {
    super(`Invalid ledger entry: ${reason}`);
  }
}

export class InvalidLedgerTransitionError extends DomainError {
  readonly code = 'ledger.invalid_transition';

  constructor(from: string, to: string) {
    super(`A ${from} ledger transaction cannot become ${to}`);
  }
}
