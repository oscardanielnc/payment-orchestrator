import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import type { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type { User as UserRow } from '../../../../../generated/prisma/client';
import { SessionRepository, UserRepository } from '../../../application/ports/auth-ports';
import type { RefreshTokenRecord, SessionRecord } from '../../../domain/refresh-token';
import { User } from '../../../domain/user';

const toUser = (row: UserRow): User => User.restore({ ...row });

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async save(user: User): Promise<void> {
    await this.txHost.tx.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        createdAt: user.createdAt,
      },
      update: { passwordHash: user.passwordHash, role: user.role },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.txHost.tx.user.findUnique({ where: { email } });
    return row ? toUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.txHost.tx.user.findUnique({ where: { id } });
    return row ? toUser(row) : null;
  }
}

@Injectable()
export class PrismaSessionRepository extends SessionRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async createSession(session: SessionRecord): Promise<void> {
    await this.txHost.tx.session.create({ data: session });
  }

  async findSession(id: string): Promise<SessionRecord | null> {
    return this.txHost.tx.session.findUnique({
      where: { id },
      select: { id: true, userId: true, createdAt: true, revokedAt: true },
    });
  }

  async revokeSession(id: string, reason: string, at: Date): Promise<void> {
    await this.txHost.tx.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: at, revokedReason: reason },
    });
  }

  async saveRefreshToken(token: RefreshTokenRecord): Promise<void> {
    await this.txHost.tx.refreshToken.create({ data: token });
  }

  async findRefreshToken(id: string): Promise<RefreshTokenRecord | null> {
    return this.txHost.tx.refreshToken.findUnique({ where: { id } });
  }

  async markRefreshTokenUsed(id: string, at: Date): Promise<boolean> {
    // The WHERE makes this a compare-and-set: of two concurrent uses, exactly one wins.
    const { count } = await this.txHost.tx.refreshToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: at },
    });
    return count === 1;
  }
}
