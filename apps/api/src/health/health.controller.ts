import { Controller, Get } from '@nestjs/common';
import { AppConfig } from '../config/app-config';

@Controller('health')
export class HealthController {
  constructor(private readonly config: AppConfig) {}

  @Get()
  check() {
    return { status: 'ok', paymentsMode: this.config.paymentsMode };
  }
}
