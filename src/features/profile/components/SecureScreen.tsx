/**
 * Blocks screenshots, screen recording and the Recents thumbnail while it is mounted
 * (FLAG_SECURE), for the Documents, KYC, GST, Bank, Security and Password screens. Render it
 * inside any sensitive screen or sheet; it draws nothing.
 */
import { useSecureScreen } from '@/core/native/secureScreen';

export function SecureScreen(): null {
  useSecureScreen();
  return null;
}
