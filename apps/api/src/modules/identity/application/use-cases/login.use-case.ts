import { Injectable } from '@nestjs/common';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner';
import { InvalidCredentialsError } from '../../domain/errors';
import { normalizeEmail, type User } from '../../domain/user';
import { PasswordHasher, UserRepository } from '../ports/auth-ports';
import { type IssuedTokens, SessionIssuer } from '../services/session-issuer';

/** Compared against when the email does not exist, so both paths cost one argon2 verify. */
const TIMING_DUMMY_PASSWORD = 'not-a-real-password-only-equalizes-timing';

@Injectable()
export class LoginUseCase {
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly issuer: SessionIssuer,
    private readonly transaction: TransactionRunner,
  ) {}

  async execute(input: {
    email: string;
    password: string;
  }): Promise<IssuedTokens & { user: User }> {
    let email: string;
    try {
      email = normalizeEmail(input.email);
    } catch {
      throw new InvalidCredentialsError();
    }

    const user = await this.users.findByEmail(email);
    // Unknown email and wrong password take the same time and give the same error:
    // response time must not reveal which emails have accounts.
    const hash = user?.passwordHash ?? (await this.timingDummyHash());
    const valid = await this.hasher.verify(hash, input.password);
    if (!user || !valid) throw new InvalidCredentialsError();

    const tokens = await this.transaction.run(() => this.issuer.startSession(user));
    return { ...tokens, user };
  }

  private timingDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(TIMING_DUMMY_PASSWORD);
    return this.dummyHash;
  }
}
