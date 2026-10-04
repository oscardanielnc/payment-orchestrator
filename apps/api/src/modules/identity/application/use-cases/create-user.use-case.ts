import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { EmailTakenError, OrganizationNotFoundError } from '../../domain/errors';
import { assertPasswordAcceptable, type MemberRole, normalizeEmail, User } from '../../domain/user';
import { PasswordHasher, UserRepository } from '../ports/auth-ports';
import { OrganizationRepository } from '../ports/organization.repository';

@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly organizations: OrganizationRepository,
    private readonly hasher: PasswordHasher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    organizationId: string;
    email: string;
    password: string;
    role: MemberRole;
  }): Promise<User> {
    assertPasswordAcceptable(input.password);
    const email = normalizeEmail(input.email);
    if (!(await this.organizations.findById(input.organizationId))) {
      throw new OrganizationNotFoundError();
    }
    if (await this.users.findByEmail(email)) throw new EmailTakenError();

    const user = User.register({
      id: this.ids.uuid(),
      organizationId: input.organizationId,
      email,
      passwordHash: await this.hasher.hash(input.password),
      role: input.role,
      now: this.clock.now(),
    });
    await this.users.save(user);
    return user;
  }
}
