// @ts-nocheck
/**
 * Tests for useQRScanner hook
 */

import React from 'react';
import { create, act } from 'react-test-renderer';
import { useQRScanner } from '../useQRScanner';

// Mock URDecoder
const mockReceivePart = jest.fn();
const mockEstimatedPercentComplete = jest.fn().mockReturnValue(0.5);
const mockIsComplete = jest.fn().mockReturnValue(false);
const mockResultUR = jest.fn();

jest.mock('@ngraveio/bc-ur', () => ({
  URDecoder: jest.fn().mockImplementation(() => ({
    receivePart: mockReceivePart,
    estimatedPercentComplete: mockEstimatedPercentComplete,
    isComplete: mockIsComplete,
    resultUR: mockResultUR,
  })),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Helper to render hooks with props
function renderHookWithProps(props) {
  const result = { current: null };
  function TestComponent({ hookProps }) {
    result.current = useQRScanner(hookProps);
    return null;
  }
  let component;
  act(() => {
    component = create(<TestComponent hookProps={props} />);
  });
  return {
    result,
    unmount: () => component.unmount(),
    rerender: (newProps) => {
      act(() => {
        component.update(<TestComponent hookProps={newProps} />);
      });
    },
  };
}

describe('useQRScanner', () => {
  const mockOnScan = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockIsComplete.mockReturnValue(false);
    mockEstimatedPercentComplete.mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should return initial state', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      expect(result.current.handleBarCodeScanned).toBeDefined();
      expect(result.current.progress).toBe(0);
      expect(result.current.isScanning).toBeFalsy();
      expect(result.current.totalChunks).toBeNull();
      expect(result.current.scannedChunks.size).toBe(0);
      expect(result.current.bcurProgress).toBe(0);
    });
  });

  describe('visibility change', () => {
    it('should reset state when visible becomes false', () => {
      const { result, rerender } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      // Simulate scanning a NUT-16 chunk to set some state
      act(() => {
        result.current.handleBarCodeScanned({ data: '1/3:chunk1!' });
      });

      expect(result.current.totalChunks).toBe(3);

      // Hide the scanner
      rerender({ visible: false, onScan: mockOnScan });

      expect(result.current.totalChunks).toBeNull();
      expect(result.current.scannedChunks.size).toBe(0);
      expect(result.current.bcurProgress).toBe(0);
    });

    it('should clear pending timeout when visible becomes false', () => {
      const { result, rerender } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      // Complete a scan to set a timeout (but don't advance timers)
      act(() => {
        result.current.handleBarCodeScanned({ data: '1/1:complete!' });
      });

      // Now hide the scanner before the timeout fires
      // This should clear the timeout (line 31)
      rerender({ visible: false, onScan: mockOnScan });

      // Advance timers - onScan should NOT be called because timeout was cleared
      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(mockOnScan).not.toHaveBeenCalled();
    });

    it('should handle visibility toggle without errors', () => {
      const { rerender } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      // Toggle visibility should not throw
      expect(() => {
        rerender({ visible: false, onScan: mockOnScan });
        rerender({ visible: true, onScan: mockOnScan });
      }).not.toThrow();
    });
  });

  describe('handleBarCodeScanned', () => {
    it('should return early if data is empty', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      act(() => {
        result.current.handleBarCodeScanned({ data: '' });
      });

      expect(mockOnScan).not.toHaveBeenCalled();
    });

    it('should return early if data is null', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      act(() => {
        result.current.handleBarCodeScanned({ data: null });
      });

      expect(mockOnScan).not.toHaveBeenCalled();
    });

    it('should ignore binary/corrupted QR data', () => {
      const { logger } = require('../../utils/logger');
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      // Binary data that's not printable and not NUT-16/UR format
      const binaryData = '\x00\x01\x02\x03';

      act(() => {
        result.current.handleBarCodeScanned({ data: binaryData });
      });

      expect(logger.warn).toHaveBeenCalledWith('[QRScanner] Detected binary/corrupted QR data, ignoring');
      expect(mockOnScan).not.toHaveBeenCalled();
    });

    it('should handle static QR codes', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      act(() => {
        result.current.handleBarCodeScanned({ data: 'bitcoin:bc1qtest' });
      });

      expect(mockOnScan).toHaveBeenCalledWith('bitcoin:bc1qtest');
    });

    it('should not scan again after hasScanned is true', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      // First scan
      act(() => {
        result.current.handleBarCodeScanned({ data: 'first-scan' });
      });

      expect(mockOnScan).toHaveBeenCalledTimes(1);

      // Second scan should be ignored
      act(() => {
        result.current.handleBarCodeScanned({ data: 'second-scan' });
      });

      expect(mockOnScan).toHaveBeenCalledTimes(1);
    });
  });

  describe('BC-UR format handling', () => {
    it('should detect BC-UR format and create decoder', () => {
      const { logger } = require('../../utils/logger');
      const { URDecoder } = require('@ngraveio/bc-ur');
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      act(() => {
        result.current.handleBarCodeScanned({ data: 'ur:bytes/1-5/test' });
      });

      expect(logger.debug).toHaveBeenCalledWith('[QRScanner] BC-UR format detected');
      expect(URDecoder).toHaveBeenCalled();
      expect(mockReceivePart).toHaveBeenCalledWith('ur:bytes/1-5/test');
    });

    it('should parse expected parts from UR data', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      act(() => {
        result.current.handleBarCodeScanned({ data: 'ur:bytes/1-10/test' });
      });

      // Progress should be set based on expected parts
      expect(result.current.bcurProgress).toBeGreaterThan(0);
    });

    it('should update progress on subsequent parts', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      // First part
      act(() => {
        result.current.handleBarCodeScanned({ data: 'ur:bytes/1-3/part1' });
      });

      const initialProgress = result.current.bcurProgress;

      // Second part
      act(() => {
        result.current.handleBarCodeScanned({ data: 'ur:bytes/2-3/part2' });
      });

      expect(result.current.bcurProgress).toBeGreaterThanOrEqual(initialProgress);
    });

    it('should complete and call onScan when decoder is complete', () => {
      mockIsComplete.mockReturnValue(true);
      mockResultUR.mockReturnValue({
        decodeCBOR: () => Buffer.from('cashuAtoken123'),
      });

      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      // First part creates decoder
      act(() => {
        result.current.handleBarCodeScanned({ data: 'ur:bytes/1-2/part1' });
      });

      // Second part completes
      act(() => {
        result.current.handleBarCodeScanned({ data: 'ur:bytes/2-2/part2' });
      });

      // Advance timers for the setTimeout
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(mockOnScan).toHaveBeenCalledWith('cashuAtoken123');
      expect(result.current.bcurProgress).toBe(0);
    });

    it('should handle BC-UR decode errors', () => {
      const { logger } = require('../../utils/logger');
      mockReceivePart.mockImplementationOnce(() => {
        throw new Error('Decode error');
      });

      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      act(() => {
        result.current.handleBarCodeScanned({ data: 'ur:bytes/invalid' });
      });

      expect(logger.error).toHaveBeenCalledWith('[QRScanner] BC-UR decode error:', { error: 'Decode error' });
      expect(result.current.bcurProgress).toBe(0);
    });

    it('should handle UR format without part numbers', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      act(() => {
        result.current.handleBarCodeScanned({ data: 'UR:BYTES/somedata' });
      });

      // Should still work without throwing
      expect(result.current.bcurProgress).toBeGreaterThan(0);
    });
  });

  describe('NUT-16 format handling', () => {
    it('should detect NUT-16 format and parse chunks', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      act(() => {
        result.current.handleBarCodeScanned({ data: '1/3:chunk1payload' });
      });

      expect(result.current.totalChunks).toBe(3);
      expect(result.current.scannedChunks.size).toBe(1);
    });

    it('should accumulate multiple chunks', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      act(() => {
        result.current.handleBarCodeScanned({ data: '1/3:chunk1' });
      });

      act(() => {
        result.current.handleBarCodeScanned({ data: '2/3:chunk2' });
      });

      expect(result.current.scannedChunks.size).toBe(2);
      expect(result.current.progress).toBeCloseTo(66.67, 0);
    });

    it('should assemble full payload when all chunks received', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      // Use special chars to prevent base64 decoding
      act(() => {
        result.current.handleBarCodeScanned({ data: '1/2:part-1!' });
      });

      act(() => {
        result.current.handleBarCodeScanned({ data: '2/2:part-2!' });
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(mockOnScan).toHaveBeenCalledWith('part-1!part-2!');
    });

    it('should handle base64 encoded payload', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      // Base64 for "hello"
      const base64Payload = btoa('hello');

      act(() => {
        result.current.handleBarCodeScanned({ data: `1/1:${base64Payload}` });
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(mockOnScan).toHaveBeenCalledWith('hello');
    });

    it('should handle non-base64 payload', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      // Not valid base64
      act(() => {
        result.current.handleBarCodeScanned({ data: '1/1:not-base64-!!!' });
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(mockOnScan).toHaveBeenCalledWith('not-base64-!!!');
    });

    it('should remove duplicate cashu prefix', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      // The prefix removal happens after base64 decode, so we need to use
      // a payload that won't be base64 decoded OR will decode to cashucashu...
      // Using special char to prevent base64 decode attempt
      act(() => {
        result.current.handleBarCodeScanned({ data: '1/1:cashucashuA!token' });
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(mockOnScan).toHaveBeenCalledWith('cashuA!token');
    });

    it('should handle chunks received out of order', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      // Use payloads with special chars so they don't get base64 decoded
      act(() => {
        result.current.handleBarCodeScanned({ data: '3/3:chunk-3!' });
        result.current.handleBarCodeScanned({ data: '1/3:chunk-1!' });
        result.current.handleBarCodeScanned({ data: '2/3:chunk-2!' });
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(mockOnScan).toHaveBeenCalledWith('chunk-1!chunk-2!chunk-3!');
    });
  });

  describe('progress calculation', () => {
    it('should calculate progress for NUT-16 chunks', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      act(() => {
        result.current.handleBarCodeScanned({ data: '1/4:chunk1' });
      });

      expect(result.current.progress).toBe(25);
      expect(result.current.isScanning).toBe(4);
    });

    it('should use bcurProgress when no NUT-16 chunks', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      act(() => {
        result.current.handleBarCodeScanned({ data: 'ur:bytes/1-2/test' });
      });

      expect(result.current.progress).toBe(result.current.bcurProgress);
      expect(result.current.isScanning).toBeTruthy();
    });
  });

  describe('timeout handling', () => {
    it('should call onScan after timeout in NUT-16 completion', () => {
      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      // Complete a NUT-16 scan (use special char to avoid base64 decode)
      act(() => {
        result.current.handleBarCodeScanned({ data: '1/1:complete-payload!' });
      });

      // onScan should not be called yet
      expect(mockOnScan).not.toHaveBeenCalled();

      // Advance timers
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(mockOnScan).toHaveBeenCalledWith('complete-payload!');
    });

    it('should call onScan after timeout in BC-UR completion', () => {
      mockIsComplete.mockReturnValue(true);
      mockResultUR.mockReturnValue({
        decodeCBOR: () => Buffer.from('token'),
      });

      const { result } = renderHookWithProps({ visible: true, onScan: mockOnScan });

      // First part creates decoder
      act(() => {
        result.current.handleBarCodeScanned({ data: 'ur:bytes/1-1/test' });
      });

      // Second scan triggers complete
      act(() => {
        result.current.handleBarCodeScanned({ data: 'ur:bytes/1-1/test' });
      });

      // onScan should not be called yet
      expect(mockOnScan).not.toHaveBeenCalled();

      // Advance timers
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(mockOnScan).toHaveBeenCalledWith('token');
    });
  });
});
