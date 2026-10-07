import type { PaymentInstructions } from '@po/contracts';
import { CopyValue } from '@po/ui/data-display/CopyValue/CopyValue';
import { formatMinorUnits } from '@po/ui/lib/money';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { NETWORK_LABEL } from './labels';

type CryptoTransfer = Extract<PaymentInstructions, { type: 'crypto_transfer' }>;

/**
 * Direction (Coinbase Commerce reference): network always visible, exact amount, copyable
 * address and a QR. The QR holds only the address: TRC-20 has no standard payment URI.
 */
export function CryptoInstructions({ instructions }: { instructions: CryptoTransfer }) {
  const [qr, setQr] = useState<string | null>(null);
  // Copied into a wallet: no thousands separators.
  const exact = formatMinorUnits(instructions.amount, instructions.token).replace(/,/g, '');

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(instructions.address, { margin: 1, width: 176 }).then((url) => {
      if (active) setQr(url);
    });
    return () => {
      active = false;
    };
  }, [instructions.address]);

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Network</dt>
        <dd className="font-semibold">{NETWORK_LABEL[instructions.network]}</dd>
        <dt className="text-muted">Token</dt>
        <dd className="font-semibold">{instructions.token}</dd>
      </dl>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">Send exactly</p>
        <CopyValue label="amount" value={exact} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">To this address</p>
        <CopyValue label="deposit address" value={instructions.address} />
      </div>

      {qr && (
        <img
          src={qr}
          width={176}
          height={176}
          alt="QR code of the deposit address"
          className="self-center rounded-sm border border-line bg-white p-1"
        />
      )}

      <p role="status" className="flex items-center gap-2 text-sm text-muted">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-warning" />
        Waiting for the transfer. This page updates on its own once the network confirms it.
      </p>
    </div>
  );
}
