import { beforeEach, describe, expect, it } from 'vitest';
import {
  ApiKeyNotFoundError,
  InvalidApiKeyError,
  InvalidOrganizationNameError,
} from '../../domain/errors';
import {
  FakeApiKeySecrets,
  FixedClock,
  ImmediateTransactionRunner,
  InMemoryApiKeyRepository,
  InMemoryOrganizationRepository,
  SequentialIdGenerator,
  testEnvironment,
} from '../../testing/fakes';
import { ApiKeyIssuer } from '../services/api-key-issuer';
import { AuthenticateApiKeyUseCase } from './authenticate-api-key.use-case';
import { CreateOrganizationUseCase } from './create-organization.use-case';
import { ListApiKeysUseCase } from './list-api-keys.use-case';
import { RevokeApiKeyUseCase } from './revoke-api-key.use-case';

describe('identity use cases', () => {
  let organizations: InMemoryOrganizationRepository;
  let apiKeys: InMemoryApiKeyRepository;
  let clock: FixedClock;
  let createOrganization: CreateOrganizationUseCase;
  let authenticate: AuthenticateApiKeyUseCase;
  let revoke: RevokeApiKeyUseCase;
  let list: ListApiKeysUseCase;

  beforeEach(() => {
    organizations = new InMemoryOrganizationRepository();
    apiKeys = new InMemoryApiKeyRepository();
    clock = new FixedClock();
    const secrets = new FakeApiKeySecrets();
    const issuer = new ApiKeyIssuer(secrets, testEnvironment, clock);

    createOrganization = new CreateOrganizationUseCase(
      organizations,
      apiKeys,
      issuer,
      new SequentialIdGenerator(),
      clock,
      new ImmediateTransactionRunner(),
    );
    authenticate = new AuthenticateApiKeyUseCase(apiKeys, secrets, testEnvironment, clock);
    revoke = new RevokeApiKeyUseCase(apiKeys, clock);
    list = new ListApiKeysUseCase(apiKeys, testEnvironment);
  });

  it('creates an organization with a first key whose secret is never stored', async () => {
    const result = await createOrganization.execute({ name: '  Acme Coffee  ' });

    expect(result.organization.name).toBe('Acme Coffee');
    expect(result.token).toMatch(/^po_test_/);
    const stored = apiKeys.rows.get(result.apiKeyId);
    expect(stored?.organizationId).toBe(result.organization.id);
    expect(stored?.secretHash).not.toContain(result.token);
  });

  it('rejects an organization name that is too short', async () => {
    await expect(createOrganization.execute({ name: 'A' })).rejects.toThrow(
      InvalidOrganizationNameError,
    );
  });

  it('authenticates a valid key and records its use', async () => {
    const { organization, apiKeyId, token } = await createOrganization.execute({ name: 'Acme' });
    clock.current = new Date('2026-10-01T13:00:00Z');

    const principal = await authenticate.execute(token);

    expect(principal).toEqual({ organizationId: organization.id, apiKeyId });
    expect(apiKeys.rows.get(apiKeyId)?.lastUsedAt).toEqual(clock.current);
  });

  it.each([
    ['malformed', (token: string) => token.slice(0, -1)],
    ['wrong secret', (token: string) => `${token.slice(0, -1)}x`],
    ['other environment', (token: string) => token.replace('po_test_', 'po_live_')],
  ])('rejects a %s key with the same error', async (_label, tamper) => {
    const { token } = await createOrganization.execute({ name: 'Acme' });

    await expect(authenticate.execute(tamper(token))).rejects.toThrow(InvalidApiKeyError);
  });

  it('rejects a revoked key immediately', async () => {
    const { organization, apiKeyId, token } = await createOrganization.execute({ name: 'Acme' });

    await revoke.execute({ organizationId: organization.id, apiKeyId });

    await expect(authenticate.execute(token)).rejects.toThrow(InvalidApiKeyError);
  });

  it("does not let an organization revoke another organization's key", async () => {
    const acme = await createOrganization.execute({ name: 'Acme' });
    const globex = await createOrganization.execute({ name: 'Globex' });

    await expect(
      revoke.execute({ organizationId: globex.organization.id, apiKeyId: acme.apiKeyId }),
    ).rejects.toThrow(ApiKeyNotFoundError);
    expect(apiKeys.rows.get(acme.apiKeyId)?.isActive).toBe(true);
  });

  it('lists keys with their prefix and no secret', async () => {
    const { organization, apiKeyId, token } = await createOrganization.execute({ name: 'Acme' });

    const [summary] = await list.execute(organization.id);

    expect(summary?.prefix).toBe(`po_test_${apiKeyId}`);
    expect(JSON.stringify(summary)).not.toContain(token);
  });
});
