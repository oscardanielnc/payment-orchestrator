/**
 * Environment tag embedded in issued tokens (`po_<tag>_...`). Comes from configuration,
 * so the module never hardcodes "test" or "live".
 */
export abstract class ApiKeyEnvironment {
  abstract readonly tag: string;
}
