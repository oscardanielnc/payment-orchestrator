import type {
  ApiKey as ApiKeyRow,
  Organization as OrganizationRow,
} from '../../../../../generated/prisma/client';
import { ApiKey } from '../../../domain/api-key';
import { Organization } from '../../../domain/organization';

// Prisma rows never leave infrastructure: they become domain objects here.

export const organizationMapper = {
  toDomain(row: OrganizationRow): Organization {
    return Organization.restore({ id: row.id, name: row.name, createdAt: row.createdAt });
  },
  toRow(organization: Organization): OrganizationRow {
    return {
      id: organization.id,
      name: organization.name,
      createdAt: organization.createdAt,
    };
  },
};

export const apiKeyMapper = {
  toDomain(row: ApiKeyRow): ApiKey {
    return ApiKey.restore({
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      secretHash: row.secretHash,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
      lastUsedAt: row.lastUsedAt,
    });
  },
  toRow(apiKey: ApiKey): ApiKeyRow {
    return {
      id: apiKey.id,
      organizationId: apiKey.organizationId,
      name: apiKey.name,
      secretHash: apiKey.secretHash,
      createdAt: apiKey.createdAt,
      revokedAt: apiKey.revokedAt,
      lastUsedAt: apiKey.lastUsedAt,
    };
  },
};
