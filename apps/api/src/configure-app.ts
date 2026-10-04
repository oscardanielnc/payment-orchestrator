import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { AppConfig } from './config/app-config';

/**
 * HTTP setup shared by `main.ts` and the e2e tests, so tests run the same pipeline as production.
 */
export function configureApp(app: INestApplication, config: AppConfig): void {
  app.setGlobalPrefix('v1');
  app.use(helmet());
  app.use(cookieParser());
  // Only the dashboard's origins may call the API from a browser, with cookies (refresh token).
  app.enableCors({ origin: config.auth.dashboardOrigins, credentials: true });
}
