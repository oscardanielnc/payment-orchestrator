import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { CryptoNetworks } from './application/ports/crypto-networks';
import {
  ChainTransferRepository,
  DepositAddressRepository,
  WatcherCursorRepository,
} from './application/ports/crypto-repositories';
import { ChainTransfersService } from './application/services/chain-transfers.service';
import { DepositAddressesService } from './application/services/deposit-addresses.service';
import { ConfiguredCryptoNetworks } from './infrastructure/configured-crypto-networks';
import {
  PrismaChainTransferRepository,
  PrismaDepositAddressRepository,
  PrismaWatcherCursorRepository,
} from './infrastructure/persistence/prisma/prisma-crypto.repositories';
import { TronGridTransferSource } from './infrastructure/tron/trongrid-transfer-source';
import { TronXpubAddressDeriver } from './infrastructure/tron/tron-xpub-address-deriver';

/**
 * Chain mechanics only: addresses, transfers, cursors. It knows nothing about charges or
 * attempts; the payments module drives it through the two exported services.
 */
@Module({
  providers: [
    {
      provide: CryptoNetworks,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        new ConfiguredCryptoNetworks({
          ...(config.tron && {
            'tron-nile': {
              deriver: new TronXpubAddressDeriver(config.tron.depositXpub),
              source: new TronGridTransferSource({
                fullHost: config.tron.fullHost,
                usdtContract: config.tron.usdtContract,
                apiKey: config.tron.apiKey,
              }),
            },
          }),
        }),
    },
    { provide: DepositAddressRepository, useClass: PrismaDepositAddressRepository },
    { provide: ChainTransferRepository, useClass: PrismaChainTransferRepository },
    { provide: WatcherCursorRepository, useClass: PrismaWatcherCursorRepository },
    DepositAddressesService,
    ChainTransfersService,
  ],
  exports: [CryptoNetworks, DepositAddressesService, ChainTransfersService],
})
export class CryptoModule {}
