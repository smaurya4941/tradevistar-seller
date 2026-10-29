/**
 * Root providers and startup wiring.
 *
 * Order matters: error boundary → safe area → query client → session provider → auth → toast →
 * preferences → launch gate → banners above the navigator, with the offline banner over it. The
 * sheets that any screen can raise (verification required, paused for maintenance) and the
 * celebration layer are mounted once here. The session
 * engine starts restoring as soon as SessionProvider mounts, in parallel with LaunchGate's config
 * check; preferences sit above the gate so the force-update and maintenance screens are
 * translated too.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '@/core/auth/SessionProvider';
import { PreferencesProvider } from '@/core/preferences/PreferencesProvider';
import { queryClient } from '@/core/query/queryClient';
import { ToastProvider } from '@/design';
import { VerificationSheet } from '@/features/access/VerificationSheet';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { CelebrationHost } from '@/features/celebration/CelebrationHost';
import { ArrivalBanner } from '@/features/notifications/ArrivalBanner';
import { NotificationEffects } from '@/features/notifications/NotificationEffects';
import { PushPermissionHost } from '@/features/notifications/PushPermissionHost';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { BelowBanners, GlobalBanners } from './components/GlobalBanners';
import { MaintenanceBlockHost } from './components/MaintenanceBlockHost';
import { OfflineBanner } from './components/OfflineBanner';
import { LaunchGate } from './LaunchGate';
import { RootNavigator } from './navigation/RootNavigator';
import { sessionEngine } from './services';
import { SessionEffects } from './SessionEffects';

export default function App() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider engine={sessionEngine}>
            <AuthProvider>
              <ToastProvider>
                <PreferencesProvider>
                  <SessionEffects />
                  <NotificationEffects />
                  <LaunchGate>
                    <View style={styles.root}>
                      <GlobalBanners />
                      <View style={styles.root}>
                        <BelowBanners>
                          <RootNavigator />
                        </BelowBanners>
                      </View>
                      <OfflineBanner />
                      <ArrivalBanner />
                      <VerificationSheet />
                      <MaintenanceBlockHost />
                      <CelebrationHost />
                      <PushPermissionHost />
                    </View>
                  </LaunchGate>
                </PreferencesProvider>
              </ToastProvider>
            </AuthProvider>
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
