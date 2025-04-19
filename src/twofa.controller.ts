import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { TwoFAService } from './twofa.service';
import { AuthGuard } from './auth.guard';

@Controller('2fa')
@UseGuards(AuthGuard)
export class TwoFAController {
  constructor(private readonly twoFAService: TwoFAService) {}

  @Post('generate')
  async generateSecret(@Body('userId') userId: string) {
    return this.twoFAService.generateSecret(userId);
  }

  @Post('verify')
  async verifyCode(
    @Body('userId') userId: string,
    @Body('token') token: string,
  ) {
    return this.twoFAService.verifyCode(userId, token);
  }

  @Post('disable')
  async disable2FA(
    @Body('userId') userId: string,
    @Body('token') token: string,
  ) {
    return this.twoFAService.disable2FA(userId, token);
  }
}
