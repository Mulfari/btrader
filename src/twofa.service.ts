import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
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
    try {
      // Verificar si el usuario ya tiene 2FA activado
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_2fa_enabled')
        .eq('id', userId)
        .single();

      if (profileError) {
        throw new BadRequestException('Error al verificar el perfil del usuario');
      }

      if (profile?.is_2fa_enabled) {
        throw new BadRequestException('El 2FA ya está activado para este usuario');
      }

      const secret = otplib.authenticator.generateSecret();
      const otpauth = otplib.authenticator.keyuri(userId, 'BTrade', secret);
      const qr = await qrcode.toDataURL(otpauth);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ totp_secret: secret, is_2fa_enabled: false })
        .eq('id', userId);

      if (updateError) {
        throw new BadRequestException('Error al guardar el secreto TOTP');
      }

      return { secret, qr };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al generar el secreto 2FA');
    }
  }

  async verifyCode(userId: string, code: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('totp_secret, is_2fa_enabled')
        .eq('id', userId)
        .single();

      if (error || !data) {
        throw new BadRequestException('Error al obtener el perfil del usuario');
      }

      if (!data.totp_secret) {
        throw new BadRequestException('No se ha configurado el 2FA para este usuario');
      }

      if (data.is_2fa_enabled) {
        throw new BadRequestException('El 2FA ya está activado para este usuario');
      }

      const isValid = otplib.authenticator.check(code, data.totp_secret);

      if (!isValid) {
        throw new UnauthorizedException('Código inválido');
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_2fa_enabled: true })
        .eq('id', userId);

      if (updateError) {
        throw new BadRequestException('Error al activar 2FA');
      }

      return { success: true, message: '2FA activado correctamente' };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al verificar el código');
    }
  }

  async disable2FA(userId: string, code: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('totp_secret, is_2fa_enabled')
        .eq('id', userId)
        .single();

      if (error || !data) {
        throw new BadRequestException('Error al obtener el perfil del usuario');
      }

      if (!data.is_2fa_enabled) {
        throw new BadRequestException('El 2FA no está activado para este usuario');
      }

      const isValid = otplib.authenticator.check(code, data.totp_secret);

      if (!isValid) {
        throw new UnauthorizedException('Código inválido');
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          is_2fa_enabled: false,
          totp_secret: null 
        })
        .eq('id', userId);

      if (updateError) {
        throw new BadRequestException('Error al desactivar 2FA');
      }

      return { success: true, message: '2FA desactivado correctamente' };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al desactivar 2FA');
    }
  }

  async check2FAStatus(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_2fa_enabled')
        .eq('id', userId)
        .single();

      if (error || !data) {
        throw new BadRequestException('Error al obtener el perfil del usuario');
      }

      return { is2FAEnabled: data.is_2fa_enabled };
    } catch (error) {
      throw new BadRequestException('Error al verificar el estado de 2FA');
    }
  }
}
