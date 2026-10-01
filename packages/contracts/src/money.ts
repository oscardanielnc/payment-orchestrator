import { z } from 'zod';

/** Currencies the API accepts, with their minor-unit decimals (ADR 0005). */
export const CURRENCY_DECIMALS = {
  USD: 2,
  PEN: 2,
  USDT: 6,
  USDC: 6,
} as const;

export const CurrencyCode = z.enum(['USD', 'PEN', 'USDT', 'USDC']);
export type CurrencyCode = z.infer<typeof CurrencyCode>;

/**
 * Money travels as a string of an integer in minor units: JSON numbers become
 * floats in JavaScript and lose precision above 2^53.
 */
export const MinorUnits = z
  .string()
  .regex(/^[1-9][0-9]{0,29}$/, 'must be a positive integer in minor units, as a string');
