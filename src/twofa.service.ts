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
      // Llamar a la función RPC para generar el secreto
      const { data, error } = await supabase
        .rpc('generate_totp_secret');

      if (error) {
        throw new BadRequestException(error.message);
      }

      return {
        success: data.success,
        secret: data.secret,
        qr: data.qr_code,
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

      // Obtener el secreto del usuario usando la función RPC
      const { data, error } = await supabase
        .rpc('verify_totp', { token });

      if (error) {
        throw new BadRequestException(error.message);
      }

      if (!data.success) {
        throw new BadRequestException(data.error);
      }

      // Verificar el token usando otplib
      const isValid = otplib.authenticator.verify({
        token,
        secret: data.secret
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

      // Si el token es válido, activar 2FA si no está activado
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

      // Llamar a la función RPC para deshabilitar 2FA
      const { data, error } = await supabase
        .rpc('disable_totp', { token });

      if (error) {
        throw new BadRequestException(error.message);
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
