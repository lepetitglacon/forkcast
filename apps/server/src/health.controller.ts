import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('api/health')
  health(): { ok: true; name: string; time: string } {
    return { ok: true, name: 'forkcast', time: new Date().toISOString() };
  }
}
