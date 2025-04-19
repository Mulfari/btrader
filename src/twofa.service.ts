import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as otplib from 'otplib';
import { createClient } from '@supabase/supabase-js';
import * as qrcode from 'qrcode';

// Configurar el autenticador TOTP con opciones más seguras
otplib.authenticator.options = {
  window: 1, // Permite una ventana de ±30 segundos
  step: 30, // Tiempo de validez del token en segundos
  digits: 6 // Longitud del token
};

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

@Injectable()
export class TwoFAService {
  async generateSecret(userId: string, clientIp?: string, userAgent?: string) {
    try {
      // Verificar si el usuario ya tiene 2FA habilitado
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_2fa_enabled')
        .eq('id', userId)
        .single();

      if (profileError) {
        throw new BadRequestException('Error al verificar el perfil del usuario');
      }

      if (profile?.is_2fa_enabled) {
        throw new BadRequestException('El 2FA ya está habilitado para este usuario');
      }

      // Obtener el email del usuario
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
      if (userError || !userData?.user) {
        throw new BadRequestException('Usuario no encontrado');
      }

      // Generar un nuevo secreto
      const secret = otplib.authenticator.generateSecret();
      
      // Generar la URL para el código QR
      const otpauth = otplib.authenticator.keyuri(
        userData.user.email || userId,
        'EdgeTrader',
        secret
      );

      // Generar el código QR
      const qr = await qrcode.toDataURL(otpauth);

      // Guardar el secreto en el perfil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          totp_secret: secret,
          is_2fa_enabled: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw new BadRequestException('Error al guardar el secreto TOTP');
      }

      return {
        success: true,
        secret,
        qr,
        error: null
      };
    } catch (error: any) {
      console.error('Error en generateSecret:', error);
      return {
        success: false,
        secret: null,
        qr: null,
        error: error.message || 'Error al generar el secreto TOTP'
      };
    }
  }

  async verifyCode(userId: string, token: string, clientIp?: string, userAgent?: string) {
    try {
      // Validar el formato del token
      if (!token || !/^\d{6}$/.test(token)) {
        throw new BadRequestException('Formato de token inválido');
      }

      // Obtener el perfil del usuario con el secreto TOTP
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('totp_secret, is_2fa_enabled')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        throw new BadRequestException('Error al obtener el perfil del usuario');
      }

      if (!profile.totp_secret) {
        throw new BadRequestException('No se encontró el secreto TOTP');
      }

      // Verificar el token usando otplib
      const isValid = otplib.authenticator.verify({
        token,
        secret: profile.totp_secret
      });

      if (!isValid) {
        // Registrar el intento fallido
        await supabase
          .from('totp_verification_logs')
          .insert({
            user_id: userId,
            verification_type: 'verify',
            success: false,
            ip_address: clientIp,
            user_agent: userAgent
          });

        throw new UnauthorizedException('Código inválido');
      }

      // Registrar el intento exitoso
      await supabase
        .from('totp_verification_logs')
        .insert({
          user_id: userId,
          verification_type: 'verify',
          success: true,
          ip_address: clientIp,
          user_agent: userAgent
        });

      // Si el token es válido y 2FA no está habilitado, activarlo
      if (!profile.is_2fa_enabled) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            is_2fa_enabled: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (updateError) {
          throw new BadRequestException('Error al activar 2FA');
        }
      }

      return {
        success: true,
        error: null
      };
    } catch (error: any) {
      console.error('Error en verifyCode:', error);
      return {
        success: false,
        error: error.message || 'Error al verificar el código'
      };
    }
  }

  async disable2FA(userId: string, token: string, clientIp?: string, userAgent?: string) {
    try {
      // Verificar el código primero
      const verifyResult = await this.verifyCode(userId, token, clientIp, userAgent);
      if (!verifyResult.success) {
        throw new UnauthorizedException(verifyResult.error || 'Código inválido');
      }

      // Desactivar 2FA
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          is_2fa_enabled: false,
          totp_secret: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw new BadRequestException('Error al desactivar 2FA');
      }

      // Registrar la desactivación
      await supabase
        .from('totp_verification_logs')
        .insert({
          user_id: userId,
          verification_type: 'disable',
          success: true,
          ip_address: clientIp,
          user_agent: userAgent
        });

      return {
        success: true,
        error: null
      };
    } catch (error: any) {
      console.error('Error en disable2FA:', error);
      return {
        success: false,
        error: error.message || 'Error al desactivar 2FA'
      };
    }
  }
}
