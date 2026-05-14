/**
 * QRScanner Component
 * Full-screen QR code scanner supporting static and animated QR codes (NUT-16)
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Icon from '../icons';
import { COLORS } from '../../theme';
import { useQRScanner } from '../../hooks/useQRScanner';
import styles from './QRScanner.styles';

interface QRScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}

export default function QRScanner({ visible, onClose, onScan }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [requestedDuringOpen, setRequestedDuringOpen] = useState(false);
  const { handleBarCodeScanned, progress, isScanning, totalChunks, scannedChunks, bcurProgress } =
    useQRScanner({ visible, onScan });

  const handlePermissionPress = useCallback(async () => {
    if (isRequestingPermission) return;

    if (permission?.canAskAgain === false) {
      await Linking.openSettings();
      return;
    }

    setIsRequestingPermission(true);
    try {
      await requestPermission();
      setRequestedDuringOpen(true);
    } finally {
      setIsRequestingPermission(false);
    }
  }, [isRequestingPermission, permission?.canAskAgain, requestPermission]);

  useEffect(() => {
    if (!visible) {
      setRequestedDuringOpen(false);
      setIsRequestingPermission(false);
      return;
    }

    if (
      !permission ||
      permission.granted ||
      permission.canAskAgain === false ||
      requestedDuringOpen ||
      isRequestingPermission
    ) {
      return;
    }

    setIsRequestingPermission(true);
    void requestPermission()
      .then(() => {
        setRequestedDuringOpen(true);
      })
      .finally(() => {
        setIsRequestingPermission(false);
      });
  }, [isRequestingPermission, permission, requestPermission, requestedDuringOpen, visible]);

  // Don't render anything if not visible - this ensures camera is fully unmounted
  if (!visible) return null;

  if (!permission) return null;

  if (!permission.granted) {
    const permissionBlocked = permission.canAskAgain === false;
    const awaitingSystemPrompt = !permissionBlocked && !requestedDuringOpen;

    return (
      <Modal visible={visible} animationType="slide" onRequestClose={permissionBlocked ? onClose : undefined}>
        <View style={styles.permissionContainer}>
          {(permissionBlocked || requestedDuringOpen) && (
            <TouchableOpacity
              style={styles.permissionCloseButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close scanner"
              testID="qr-scanner-permission-close"
            >
              <Icon name="close" size={24} color={COLORS.WHITE} />
            </TouchableOpacity>
          )}
          <Icon name="qr_scan" size={64} color={COLORS.VERY_LIGHT_GRAY} />
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionText}>
            {permissionBlocked
              ? 'Camera access is blocked. Enable it in Settings to scan QR codes.'
              : requestedDuringOpen
                ? 'Camera access was not granted. Allow camera access to scan wallet addresses, payment requests, and e-cash tokens.'
                : 'DUCAT uses the camera to scan wallet addresses, payment requests, and e-cash tokens.'}
          </Text>
          <View style={styles.permissionActions}>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={awaitingSystemPrompt ? undefined : handlePermissionPress}
              disabled={isRequestingPermission || awaitingSystemPrompt}
              accessibilityRole="button"
              testID="qr-scanner-permission-continue"
            >
              {isRequestingPermission || awaitingSystemPrompt ? (
                <ActivityIndicator color={COLORS.WHITE} />
              ) : (
                <Text style={styles.permissionButtonText}>
                  {permissionBlocked ? 'Open Settings' : 'Try Again'}
                </Text>
              )}
            </TouchableOpacity>
            {(permissionBlocked || requestedDuringOpen) && (
              <TouchableOpacity
                style={styles.permissionSecondaryButton}
                onPress={onClose}
                accessibilityRole="button"
                testID="qr-scanner-permission-close-secondary"
              >
                <Text style={styles.permissionSecondaryButtonText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        >
          <View style={styles.overlay}>
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Icon name="close" size={28} color={COLORS.WHITE} />
              </TouchableOpacity>
            </View>
            <View style={styles.scanFrame}>
              {isScanning && (
                <View style={styles.progressOverlay}>
                  <Text style={styles.overlayText}>
                    {bcurProgress > 0 ? 'Scanning BC-UR token...' : 'Scanning animated QR code...'}
                  </Text>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${progress}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                      {totalChunks
                        ? `${scannedChunks.size} / ${totalChunks} frames`
                        : `${Math.round(bcurProgress)}% complete`}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </CameraView>
      </View>
    </Modal>
  );
}
