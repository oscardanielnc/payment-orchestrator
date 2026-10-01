/** What the customer must do to complete an attempt. Mirrors the API contract. */
export type PaymentInstructions =
  | { type: 'card_client_secret'; clientSecret: string }
  | { type: 'redirect'; url: string }
  | {
      type: 'crypto_transfer';
      network: 'tron-nile' | 'base-sepolia';
      token: 'USDT' | 'USDC';
      address: string;
      /** Exact amount in the token's minor units. */
      amount: string;
    };
