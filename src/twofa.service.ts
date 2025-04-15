import { Injectable } from '@nestjs/common';
import * as otplib from 'otplib';
import { createClient } from '@supabase/supabase-js';
import * as qrcode from 'qrcode';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

@Injectable()
export class TwoFAService {
  async generateSecret(userId: string) {
    const secret = otplib.authenticator.generateSecret();
    const otpauth = otplib.authenticator.keyuri(userId, 'EdgeTrader', secret);
    const qr = await qrcode.toDataURL(otpauth);
    await supabase
      .from('profiles')
      .update({ totp_secret: secret, is_2fa_enabled: false })
      .eq('id', userId);
    return { secret, otpauth, qr };
  }

  async verifyCode(userId: string, code: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('totp_secret')
      .eq('id', userId)
      .single();
    if (error || !data?.totp_secret) return { success: false, error: 'No secret' };
    const valid = otplib.authenticator.check(code, data.totp_secret);
    if (valid) {
      await supabase
        .from('profiles')
        .update({ is_2fa_enabled: true })
        .eq('id', userId);
    }
    return { success: valid };
  }
}
