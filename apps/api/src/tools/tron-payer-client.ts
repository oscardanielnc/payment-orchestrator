import { TronWeb } from 'tronweb';
import type { TronConfig } from '../config/app-config';

/** The two TRC-20 calls the dev tools need; TronWeb's own contract type is `any`. */
interface Trc20Contract {
  balanceOf(owner: string): { call(): Promise<unknown> };
  transfer(to: string, amount: string): { send(options: { feeLimit: number }): Promise<string> };
}

export interface TronPayer {
  address: string;
  balances(): Promise<{ trx: number; usdtUnits: bigint }>;
  /** Sends test USDT; returns the transaction id. */
  pay(to: string, units: string): Promise<string>;
}

/**
 * The test CUSTOMER wallet (TRON_TEST_PAYER_PRIVATE_KEY). Network and token come from the
 * validated config, so it cannot point at mainnet.
 */
export async function createTronPayer(tron: TronConfig): Promise<TronPayer> {
  const privateKey = process.env.TRON_TEST_PAYER_PRIVATE_KEY;
  if (!privateKey) throw new Error('Set TRON_TEST_PAYER_PRIVATE_KEY (run "tron:payer new" first)');

  const tronWeb = new TronWeb({
    fullHost: tron.fullHost,
    privateKey,
    ...(tron.apiKey && { headers: { 'TRON-PRO-API-KEY': tron.apiKey } }),
  });
  const address = tronWeb.defaultAddress.base58;
  if (!address) throw new Error('Invalid TRON_TEST_PAYER_PRIVATE_KEY');
  const usdt = (await tronWeb.contract().at(tron.usdtContract)) as unknown as Trc20Contract;

  return {
    address,
    async balances() {
      const trx = await tronWeb.trx.getBalance(address);
      const usdtUnits = BigInt(String(await usdt.balanceOf(address).call()));
      return { trx: trx / 1e6, usdtUnits };
    },
    pay(to, units) {
      return usdt.transfer(to, units).send({ feeLimit: 100_000_000 });
    },
  };
}

export const tronscanTx = (txid: string) => `https://nile.tronscan.org/#/transaction/${txid}`;
