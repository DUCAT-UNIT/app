/**
 * useQRScanner Hook
 * Handles QR code scanning logic including BC-UR and NUT-16 animated QR support
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { URDecoder } from '@ngraveio/bc-ur';
import { logger } from '../utils/logger';

export function useQRScanner({ visible, onScan }) {
  const [scannedChunks, setScannedChunks] = useState(new Map());
  const [totalChunks, setTotalChunks] = useState(null);
  const [bcurDecoder, setBcurDecoder] = useState(null);
  const [bcurProgress, setBcurProgress] = useState(0);
  const [, setBcurReceivedParts] = useState(0);
  const [bcurExpectedParts, setBcurExpectedParts] = useState(null);
  const [hasScanned, setHasScanned] = useState(false);
  const scanTimeoutRef = useRef(null);

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

  const handleBarCodeScanned = useCallback(({ data }) => {
    if (!data || hasScanned) return;

    // Validate readable data
    const isPrintable = /^[\x20-\x7E\n\r\t]*$/.test(data.substring(0, 100));
    const dataLower = data.toLowerCase();
    if (!isPrintable && !data.match(/^\d+\/\d+:/) && !dataLower.startsWith('ur:')) {
      logger.warn('[QRScanner] Detected binary/corrupted QR data, ignoring');
      return;
    }

    // BC-UR format handling
    if (dataLower.startsWith('ur:')) {
      handleBcurScan(data);
      return;
    }

    // NUT-16 animated QR code
    const nut16Match = data.match(/^(\d+)\/(\d+):(.+)$/);
    if (nut16Match) {
      handleNut16Scan(nut16Match);
      return;
    }

    // Static QR code
    setHasScanned(true);
    onScan(data);
  }, [hasScanned, bcurDecoder, bcurExpectedParts, onScan]);

  const handleBcurScan = useCallback((data) => {
    logger.debug('[QRScanner] BC-UR format detected');

    try {
      if (!bcurDecoder) {
        const decoder = new URDecoder();
        setBcurDecoder(decoder);
        decoder.receivePart(data);

        const urMatch = data.match(/ur:bytes\/(\d+)-(\d+)\//i);
        if (urMatch) {
          setBcurExpectedParts(parseInt(urMatch[2], 10));
        }

        setBcurReceivedParts(1);
        setBcurProgress(bcurExpectedParts ? (1 / bcurExpectedParts) * 100 : 5);
      } else {
        bcurDecoder.receivePart(data);

        const decoderProgress = bcurDecoder.estimatedPercentComplete();
        const isComplete = bcurDecoder.isComplete();

        setBcurReceivedParts(prev => prev + 1);
        setBcurProgress(isComplete ? 100 : Math.min(decoderProgress * 100, 95));

        if (isComplete) {
          const ur = bcurDecoder.resultUR();
          const decoded = ur.decodeCBOR();
          const tokenString = decoded.toString('utf-8');

          if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
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
      logger.error('[QRScanner] BC-UR decode error:', error);
      setBcurDecoder(null);
      setBcurProgress(0);
      setBcurReceivedParts(0);
      setBcurExpectedParts(null);
    }
  }, [bcurDecoder, bcurExpectedParts, onScan]);

  const handleNut16Scan = useCallback((match) => {
    const [, currentChunk, total, payload] = match;
    const chunkNum = parseInt(currentChunk, 10);
    const totalNum = parseInt(total, 10);

    setTotalChunks(totalNum);
    setScannedChunks(prev => {
      const newChunks = new Map(prev);
      newChunks.set(chunkNum, payload);

      if (newChunks.size === totalNum) {
        let fullPayload = '';
        for (let i = 1; i <= totalNum; i++) {
          fullPayload += newChunks.get(i) || '';
        }

        // Try base64 decode
        let finalPayload = fullPayload;
        try {
          if (/^[A-Za-z0-9+/=]+$/.test(fullPayload)) {
            finalPayload = atob(fullPayload);
          }
        } catch {
          // Use raw payload
        }

        // Remove duplicate prefix
        if (finalPayload.startsWith('cashucashu')) {
          finalPayload = finalPayload.substring(5);
        }

        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        setHasScanned(true);
        scanTimeoutRef.current = setTimeout(() => {
          onScan(finalPayload);
          setScannedChunks(new Map());
          setTotalChunks(null);
        }, 100);
      }

      return newChunks;
    });
  }, [onScan]);

  const progress = totalChunks ? (scannedChunks.size / totalChunks) * 100 : bcurProgress;
  const isScanning = totalChunks || bcurProgress > 0;

  return {
    handleBarCodeScanned,
    progress,
    isScanning,
    totalChunks,
    scannedChunks,
    bcurProgress,
  };
}
