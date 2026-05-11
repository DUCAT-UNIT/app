/**
 * TurboClaimingScreen
 * Compatibility shim for older navigation paths. Token claiming is handled by
 * the root Turbo token processor so account switching and retries use one path.
 */

import React, { useEffect } from 'react';
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationProp, RouteProp } from '@react-navigation/native';
import { COLORS } from '../../theme';
import { useTokenProcessingStore } from '../../stores/tokenProcessingStore';
import { logger } from '../../utils/logger';

interface TurboClaimingRouteParams {
  tokenString?: string;
  token?: string;
}

interface TurboClaimingScreenProps {
  navigation: NavigationProp<Record<string, object | undefined>>;
  route: RouteProp<{ params: TurboClaimingRouteParams }, 'params'>;
}

export default function TurboClaimingScreen({ navigation, route }: TurboClaimingScreenProps): React.JSX.Element {
  const setPendingToken = useTokenProcessingStore((state) => state.setPendingToken);
  const triggerTokenCheck = useTokenProcessingStore((state) => state.triggerTokenCheck);
  const tokenString = route.params?.tokenString ?? route.params?.token ?? '';

  useEffect(() => {
    const token = tokenString.trim();
    if (!token) {
      navigation.navigate('Wallet', {
        claimError: 'No token was provided for claiming.',
      });
      return;
    }

    void (async () => {
      logger.cashu('claim_screen_queued_token', {
        step: 'UI_CLAIM',
        tokenLength: token.length,
        message: 'Queued legacy TurboClaiming token in root processor',
      });
      await setPendingToken(token);
      triggerTokenCheck();
      navigation.navigate('Wallet');
    })().catch((error) => {
      logger.error('[TurboClaimingScreen] Failed to queue token claim', {
        error: error instanceof Error ? error.message : String(error),
      });
      navigation.navigate('Wallet', {
        claimError: 'Failed to queue token claim. Please try again.',
        claimToken: token,
      });
    });
  }, [navigation, setPendingToken, tokenString, triggerTokenCheck]);

  return (
    <View style={localStyles.container} testID="turbo-claiming-screen">
      <View style={localStyles.content}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY_BLUE} style={localStyles.spinner} testID="turbo-claiming-spinner" />
        <Text style={localStyles.title} testID="turbo-claiming-title">Claiming Token</Text>
        <Text style={localStyles.message} testID="turbo-claiming-message">Preparing claim</Text>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  spinner: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.VERY_LIGHT_GRAY,
    fontFamily: 'CabinetGrotesk-Bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'center',
  },
});
