/**
 * Unit of work (ADR 0004). Every repository call inside `run` shares one
 * database transaction; use cases decide where it starts, without knowing Prisma.
 */
export abstract class TransactionRunner {
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
