/**
 * QRScanner Component
 * Full-screen QR code scanner supporting static and animated QR codes (NUT-16)
 */

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { URDecoder } from '@ngraveio/bc-ur';
import Icon from '../icons';
import { COLORS } from '../../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function QRScanner({ visible, onClose, onScan }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedChunks, setScannedChunks] = useState(new Map());
  const [totalChunks, setTotalChunks] = useState(null);
  const [bcurDecoder, setBcurDecoder] = useState(null);
  const [bcurProgress, setBcurProgress] = useState(0);
  const [bcurReceivedParts, setBcurReceivedParts] = useState(0);
  const [bcurExpectedParts, setBcurExpectedParts] = useState(null);
  const scanTimeoutRef = useRef(null);
  const [hasScanned, setHasScanned] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setScannedChunks(new Map());
      setTotalChunks(null);
      setBcurDecoder(null);
      setBcurProgress(0);
      setBcurReceivedParts(0);
      setBcurExpectedParts(null);
      setHasScanned(false);
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    }
  }, [visible]);

  const handleBarCodeScanned = ({ data }) => {
    if (!data) return;

    // Prevent multiple scans - stop after first successful scan
    if (hasScanned) return;

    // Validate that data is readable (not binary garbage)
    const isPrintable = /^[\x20-\x7E\n\r\t]*$/.test(data.substring(0, 100));
    const dataLower = data.toLowerCase();
    if (!isPrintable && !data.match(/^\d+\/\d+:/) && !dataLower.startsWith('ur:')) {
      console.warn('[QRScanner] Detected binary/corrupted QR data, ignoring');
      return;
    }

    // Check if this is BC-UR format: ur:bytes/seqNum-seqLen/data (case-insensitive)
    if (dataLower.startsWith('ur:')) {
      console.log('[QRScanner] BC-UR format detected');

      try {
        // Initialize decoder on first scan
        if (!bcurDecoder) {
          const decoder = new URDecoder();
          setBcurDecoder(decoder);
          decoder.receivePart(data);

          // Extract expected parts from first QR code (format: ur:bytes/seq-total/data)
          const urMatch = data.match(/ur:bytes\/(\d+)-(\d+)\//i);
          if (urMatch) {
            const expectedTotal = parseInt(urMatch[2], 10);
            setBcurExpectedParts(expectedTotal);
            console.log('[QRScanner] BC-UR expected parts:', expectedTotal);
          }

          setBcurReceivedParts(1);
          const progress = bcurExpectedParts ? (1 / bcurExpectedParts) * 100 : 5;
          setBcurProgress(progress);
          console.log('[QRScanner] BC-UR decoder initialized, part 1 received');
        } else {
          // Feed part to existing decoder
          bcurDecoder.receivePart(data);

          // Increment received parts count
          const newReceivedParts = bcurReceivedParts + 1;
          setBcurReceivedParts(newReceivedParts);

          // Calculate progress based on actual parts received
          const progress = bcurExpectedParts
            ? Math.min((newReceivedParts / bcurExpectedParts) * 100, 95) // Cap at 95% until complete
            : Math.min(newReceivedParts * 5, 95); // Fallback: 5% per part, cap at 95%

          setBcurProgress(progress);
          console.log('[QRScanner] BC-UR part received:', newReceivedParts, '/', bcurExpectedParts || '?', 'progress:', Math.round(progress), '%');

          // Check if complete
          if (bcurDecoder.isComplete()) {
            setBcurProgress(100);
            console.log('[QRScanner] BC-UR decoding complete!');

            const ur = bcurDecoder.resultUR();
            const decoded = ur.decodeCBOR();
            const tokenString = decoded.toString('utf-8');

            console.log('[QRScanner] Decoded token length:', tokenString.length);
            console.log('[QRScanner] Token starts with:', tokenString.substring(0, 50));

            // Call onScan with the decoded token
            if (scanTimeoutRef.current) {
              clearTimeout(scanTimeoutRef.current);
            }
            setHasScanned(true);
            scanTimeoutRef.current = setTimeout(() => {
              onScan(tokenString);
              setBcurDecoder(null);
              setBcurProgress(0);
              setBcurReceivedParts(0);
              setBcurExpectedParts(null);
            }, 100);
          }
        }
      } catch (error) {
        console.error('[QRScanner] BC-UR decode error:', error);
        // Reset decoder on error
        setBcurDecoder(null);
        setBcurProgress(0);
        setBcurReceivedParts(0);
        setBcurExpectedParts(null);
      }
      return;
    }

    // Check if this is a NUT-16 animated QR code chunk: index/total:base64_chunk
    const nut16Match = data.match(/^(\d+)\/(\d+):(.+)$/);

    if (nut16Match) {
      // Animated QR code (NUT-16)
      const [, currentChunk, total, payload] = nut16Match;
      const chunkNum = parseInt(currentChunk, 10);
      const totalNum = parseInt(total, 10);

      console.log('[QRScanner] Chunk scanned:', { chunkNum, totalNum, payloadLength: payload.length });

      setTotalChunks(totalNum);
      setScannedChunks(prev => {
        const newChunks = new Map(prev);
        newChunks.set(chunkNum, payload);

        console.log('[QRScanner] Chunks collected:', newChunks.size, '/', totalNum);

        // Check if we have all chunks
        if (newChunks.size === totalNum) {
          // Reconstruct the full payload by concatenating chunks
          let fullPayload = '';
          for (let i = 1; i <= totalNum; i++) {
            fullPayload += newChunks.get(i) || '';
          }

          console.log('[QRScanner] All chunks collected, reassembled length:', fullPayload.length);
          console.log('[QRScanner] Reassembled payload starts with:', fullPayload.substring(0, 100));

          // Try to decode as base64 first, if that fails, use as-is
          let finalPayload = fullPayload;
          try {
            // Check if it looks like base64
            if (/^[A-Za-z0-9+/=]+$/.test(fullPayload)) {
              finalPayload = atob(fullPayload);
              console.log('[QRScanner] Decoded from base64, length:', finalPayload.length);
            } else {
              console.log('[QRScanner] Not base64, using as-is');
            }
          } catch (error) {
            console.log('[QRScanner] Base64 decode failed, using raw payload:', error.message);
          }

          // Remove duplicate 'cashu' prefix if present (e.g., 'cashucashuA' -> 'cashuA')
          if (finalPayload.startsWith('cashucashu')) {
            finalPayload = finalPayload.substring(5); // Remove first 'cashu'
            console.log('[QRScanner] Removed duplicate prefix, now starts with:', finalPayload.substring(0, 50));
          }

          console.log('[QRScanner] Final payload starts with:', finalPayload.substring(0, 100));

          // Call onScan with the final payload
          if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current);
          }
          setHasScanned(true);
          scanTimeoutRef.current = setTimeout(() => {
            onScan(finalPayload);
            setScannedChunks(new Map());
            setTotalChunks(null);
          }, 100);
        }

        return newChunks;
      });
    } else {
      // Static QR code - scan immediately
      setHasScanned(true);
      onScan(data);
    }
  };

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.permissionContainer}>
          <Icon name="qr_scan" size={64} color={COLORS.SECONDARY_TEXT} />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            Please grant camera access to scan QR codes
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  const progress = totalChunks ? (scannedChunks.size / totalChunks) * 100 : bcurProgress;
  const isScanning = totalChunks || bcurProgress > 0;

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          {/* Overlay */}
          <View style={styles.overlay}>
            {/* Top bar with close button */}
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Icon name="close" size={28} color={COLORS.WHITE} />
              </TouchableOpacity>
            </View>

            {/* Scanning frame */}
            <View style={styles.scanFrame}>
              {/* Progress overlay - centered over camera */}
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

QRScanner.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onScan: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  topBar: {
    paddingTop: 50,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 1000, // Ensure it appears on top
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001, // Ensure it appears on top
  },
  scanFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 40,
    alignItems: 'center',
  },
  overlayText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'center',
    marginBottom: 20,
  },
  corner: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderColor: COLORS.PRIMARY_BLUE,
  },
  cornerTopLeft: {
    top: (SCREEN_HEIGHT - 300) / 2,
    left: (SCREEN_WIDTH - 300) / 2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTopRight: {
    top: (SCREEN_HEIGHT - 300) / 2,
    right: (SCREEN_WIDTH - 300) / 2,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBottomLeft: {
    bottom: (SCREEN_HEIGHT - 300) / 2,
    left: (SCREEN_WIDTH - 300) / 2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBottomRight: {
    bottom: (SCREEN_HEIGHT - 300) / 2,
    right: (SCREEN_WIDTH - 300) / 2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  bottomContainer: {
    paddingBottom: 80,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  instructionText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
    textAlign: 'center',
    marginBottom: 20,
  },
  progressContainer: {
    width: 250,
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY_BLUE,
    borderRadius: 4,
  },
  progressText: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontFamily: 'CabinetGrotesk-Regular',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.WHITE,
    fontFamily: 'CabinetGrotesk-Bold',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: COLORS.SECONDARY_TEXT,
    fontFamily: 'CabinetGrotesk-Regular',
    textAlign: 'center',
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: COLORS.PRIMARY_BLUE,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'CabinetGrotesk-Bold',
  },
  cancelButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  cancelButtonText: {
    color: COLORS.SECONDARY_TEXT,
    fontSize: 16,
    fontFamily: 'CabinetGrotesk-Medium',
  },
});
