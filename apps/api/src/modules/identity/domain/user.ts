import { InvalidEmailError, WeakPasswordError } from './errors';

export type MemberRole = 'owner' | 'member';

export interface UserProps {
  id: string;
  organizationId: string;
  email: string;
  passwordHash: string;
  role: MemberRole;
  createdAt: Date;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Rules for a new password; checked before hashing, never stored. */
export function assertPasswordAcceptable(password: string): void {
  // Length beats composition rules (NIST 800-63B): 12+ characters, no maximum below 128.
  if (password.length < 12 || password.length > 128) throw new WeakPasswordError();
}

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL.test(normalized) || normalized.length > 254) throw new InvalidEmailError();
  return normalized;
}

/** A dashboard user. MVP: one organization per user, with a role in it. */
export class User {
  private constructor(private readonly props: UserProps) {}

  static register(input: Omit<UserProps, 'createdAt'> & { now: Date }): User {
    const { now, ...rest } = input;
    return new User({ ...rest, email: normalizeEmail(input.email), createdAt: now });
  }

  static restore(props: UserProps): User {
    return new User({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get email(): string {
    return this.props.email;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get role(): MemberRole {
    return this.props.role;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
