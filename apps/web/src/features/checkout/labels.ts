import type { PaymentMethod } from '@po/contracts';

/** Every network is named with "testnet": the checkout never presents a real-money network. */
export const METHOD_LABEL: Record<PaymentMethod, string> = {
  card: 'Card',
  mercadopago: 'Mercado Pago (test)',
  usdt_tron: 'USDT on TRON Nile testnet',
  usdc_base: 'USDC on Base Sepolia testnet',
};

export const NETWORK_LABEL: Record<'tron-nile' | 'base-sepolia', string> = {
  'tron-nile': 'TRON Nile testnet (TRC-20)',
  'base-sepolia': 'Base Sepolia testnet (ERC-20)',
};
