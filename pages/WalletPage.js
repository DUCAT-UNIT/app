/**
 * WalletPage - Main wallet interface after authentication
 * Contains wallet screen, vault, settings, and transaction flows
 */

import React, { useState, useRef } from 'react';
import { View, Animated, PanResponder, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Components
import WalletScreen from '../components/WalletScreen';
import SendScreen from '../components/SendScreen';
import ReceiveScreen from '../components/ReceiveScreen';
import TransactionHistoryScreen from '../components/TransactionHistoryScreen';
import VaultScreen from '../components/VaultScreen';
import SettingsScreen from '../components/SettingsScreen';
import MutinynetBanner from '../components/MutinynetBanner';
import BottomNavigationBar from '../components/BottomNavigationBar';
import Toast from '../components/Toast';
import TransactionToast from '../components/TransactionToast';

// Contexts
import { useWallet } from '../contexts/WalletContext';
import { useTransaction } from '../contexts/TransactionContext';

// Hooks
import { useToast } from '../hooks/useToast';
import { useSettings } from '../hooks/useSettings';

// Utils
import { COLORS } from '../utils/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WalletPage({
  styles,
  resetInactivityTimer,
  handleOpenVault,
  vaultCredentials,
  autoCreateVaultTrigger,
  amountInputRef,
  setShowAccountPicker,
  settingsHandlers, // All settings handlers from App.js
  biometricEnabled,
  activeTab, // Passed from App.js
  setActiveTab, // Passed from App.js
  keyboardHeight, // Passed from App.js
}) {
  // Wallet context
  const {
    wallet,
    segwitBalance,
    runesBalance,
    btcPrice,
    switchingAccount,
  } = useWallet();

  // Transaction context
  const {
    sendIntent,
    intentStep,
    sendAssetType,
    sendAmount,
    sendRecipient,
    sendAddressType,
    broadcastedTxid,
    toastDismissed,
    setIntentStep,
    setSendAssetType,
    setSendAmount,
    setSendRecipient,
    setSendIntent,
    setBroadcastedTxid,
    setToastDismissed,
    createSendIntent,
    signIntent,
  } = useTransaction();

  // Toast hook
  const { toastVisible, toastMessage, toastType, showToast } = useToast();

  // Local state (not passed from parent)
  const [showReceiveSheet, setShowReceiveSheet] = useState(false);
  const [showTxHistory, setShowTxHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Animated values for settings swipe
  const settingsTranslateX = useRef(new Animated.Value(0)).current;
  const settingsPanResponderRef = useRef(null);

  // Create settings pan responder
  if (!settingsPanResponderRef.current) {
    settingsPanResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx > 0) {
          settingsTranslateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > SCREEN_WIDTH * 0.4) {
          Animated.timing(settingsTranslateX, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setShowSettings(false);
            settingsTranslateX.setValue(0);
          });
        } else {
          Animated.spring(settingsTranslateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    });
  }

  return (
    <>
      <View
        style={{ flex: 1, backgroundColor: COLORS.DARK_BG }}
        onTouchStart={resetInactivityTimer}
      >
        {/* Mutinynet Banner - Shows on all screens */}
        <MutinynetBanner />

        {activeTab === 'wallet' ? (
          <>
            <WalletScreen
              styles={styles}
              onSendPress={() => setIntentStep('selecting_asset')}
              onReceivePress={() => setShowReceiveSheet(true)}
              onHistoryPress={() => setShowTxHistory(true)}
              onSettingsPress={() => {
                settingsTranslateX.setValue(0);
                setShowSettings(true);
              }}
              onCreateVaultPress={() => handleOpenVault(true)}
              sendAddressType={sendAddressType}
              switchingAccount={switchingAccount}
              showZeroAssets={showZeroAssets}
            />
            <BottomNavigationBar
              activeTab={activeTab}
              onVaultPress={handleOpenVault}
              onWalletPress={() => setActiveTab('wallet')}
            />
          </>
        ) : null}

        {/* Send Transaction Bottom Sheets */}
        <SendScreen
          intentStep={intentStep}
          sendAssetType={sendAssetType}
          sendAmount={sendAmount}
          sendRecipient={sendRecipient}
          sendIntent={sendIntent}
          broadcastedTxid={broadcastedTxid}
          keyboardHeight={keyboardHeight}
          amountInputRef={amountInputRef}
          btcBalance={segwitBalance}
          unitBalance={runesBalance.length > 0 ? parseFloat(runesBalance[0][1]) : 0}
          btcPrice={btcPrice}
          wallet={wallet}
          setIntentStep={setIntentStep}
          setSendAssetType={setSendAssetType}
          setSendAmount={setSendAmount}
          setSendRecipient={setSendRecipient}
          setSendIntent={setSendIntent}
          setBroadcastedTxid={setBroadcastedTxid}
          createSendIntent={createSendIntent}
          signIntent={signIntent}
        />

        {/* Receive Bottom Sheet */}
        <ReceiveScreen
          styles={styles}
          showReceiveSheet={showReceiveSheet}
          onClose={() => setShowReceiveSheet(false)}
          segwitAddress={wallet?.segwitAddress || ''}
          taprootAddress={wallet?.taprootAddress || ''}
          showToast={showToast}
        />

        {/* Transaction History Bottom Sheet */}
        <TransactionHistoryScreen
          styles={styles}
          showHistorySheet={showTxHistory}
          onClose={() => setShowTxHistory(false)}
          segwitAddress={wallet?.segwitAddress || ''}
          taprootAddress={wallet?.taprootAddress || ''}
          vaultPubkey={wallet?.taprootPubkey || ''}
        />

        <StatusBar style="light" />

        {/* Toast Notification */}
        <Toast visible={toastVisible} message={toastMessage} type={toastType} styles={styles} />

        {/* Transaction Toast */}
        <TransactionToast
          visible={
            ['pending', 'confirmed'].includes(intentStep) &&
            (intentStep === 'confirmed' || !toastDismissed)
          }
          status={intentStep}
          message={
            intentStep === 'pending' ? 'Transaction pending...' :
            intentStep === 'confirmed' ? 'Transaction mined!' :
            ''
          }
          txid={broadcastedTxid}
          assetType={sendAssetType === 'unit' ? 'UNIT' : 'BTC'}
          onClose={() => setToastDismissed(true)}
        />
      </View>

      {/* Vault Screen Full Screen Overlay - Always rendered to preload in background */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: COLORS.DARK_BG,
          zIndex: activeTab === 'vault' ? 500 : -1,
          opacity: activeTab === 'vault' ? 1 : 0,
          pointerEvents: activeTab === 'vault' ? 'auto' : 'none',
          flexDirection: 'column',
        }}
      >
        <MutinynetBanner />
        <View style={{ flex: 1 }}>
          <VaultScreen
            visible={activeTab === 'vault'}
            walletCredentials={vaultCredentials}
            autoCreateVaultTrigger={autoCreateVaultTrigger}
          />
        </View>
        <BottomNavigationBar
          activeTab={activeTab}
          onVaultPress={handleOpenVault}
          onWalletPress={() => setActiveTab('wallet')}
        />
      </View>

      {/* Settings Screen Overlay */}
      {showSettings && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: COLORS.DARK_BG,
            zIndex: 1000,
            transform: [{ translateX: settingsTranslateX }]
          }}
          {...settingsPanResponderRef.current.panHandlers}
        >
          <MutinynetBanner />
          <SettingsScreen
            onClose={() => {
              settingsTranslateX.setValue(0);
              setShowSettings(false);
            }}
            onViewSeedPhrase={settingsHandlers.handleViewSeedPhrase}
            onChangePin={settingsHandlers.handleChangePin}
            onSwitchAccount={() => {
              settingsTranslateX.setValue(0);
              setShowSettings(false);
              setShowAccountPicker(true);
            }}
            onLockWallet={settingsHandlers.handleLogout}
            onDeleteWallet={settingsHandlers.handleDeleteWallet}
            onPrivacyModeToggle={settingsHandlers.handlePrivacyModeToggle}
            onFaceIdToggle={settingsHandlers.handleFaceIdToggle}
            onNotificationsToggle={settingsHandlers.handleNotificationsToggle}
            onShowZeroAssetsToggle={settingsHandlers.handleShowZeroAssetsToggle}
            privacyMode={settingsHandlers.privacyMode}
            faceIdEnabled={biometricEnabled}
            notificationsEnabled={settingsHandlers.notificationsEnabled}
            showZeroAssets={settingsHandlers.showZeroAssets}
          />
        </Animated.View>
      )}
    </>
  );
}
