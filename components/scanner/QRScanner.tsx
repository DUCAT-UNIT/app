/**
 * QRScanner Component
 * Full-screen QR code scanner supporting static and animated QR codes (NUT-16)
 */

import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
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
  const { handleBarCodeScanned, progress, isScanning, totalChunks, scannedChunks, bcurProgress } =
    useQRScanner({ visible, onScan });

  // Don't render anything if not visible - this ensures camera is fully unmounted
  if (!visible) return null;

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.permissionContainer}>
          <Icon name="qr_scan" size={64} color={COLORS.VERY_LIGHT_GRAY} />
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionText}>
            DUCAT needs camera access to scan QR codes for sending Bitcoin.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Continue</Text>
          </TouchableOpacity>
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

