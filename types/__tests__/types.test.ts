/**
 * Type Tests
 * Uses expect-type to verify TypeScript types at compile time
 * These tests ensure our types behave correctly without runtime execution
 */

import { expectTypeOf } from 'expect-type';
import type { PinVerificationResult } from '../../services/pinService';
import type {
  SettingTypeMap,
  SettingItem,
  SettingValue,
} from '../../services/settingsService';
import type {
  CashuProof,
  ProofStateValue,
  DecodedToken,
  MintQuoteResponse,
} from '../cashu';
import type {
  Nullable,
  Optional,
  AsyncFunction,
  ApiResponse,
} from '../index';

describe('Type Tests', () => {
  describe('PinVerificationResult discriminated union', () => {
    it('should narrow to success type when success is true', () => {
      const successResult: PinVerificationResult = { success: true };

      if (successResult.success) {
        // Should have no error or remainingAttempts properties
        expectTypeOf(successResult).toEqualTypeOf<{ success: true }>();
      }
    });

    it('should narrow to failure type when success is false', () => {
      const failureResult: PinVerificationResult = {
        success: false,
        error: 'Incorrect PIN',
        remainingAttempts: 5,
      };

      if (!failureResult.success) {
        // Should have error and remainingAttempts
        expectTypeOf(failureResult.error).toBeString();
        expectTypeOf(failureResult.remainingAttempts).toBeNumber();
      }
    });
  });

  describe('SettingTypeMap', () => {
    it('should map string type correctly', () => {
      expectTypeOf<SettingTypeMap['string']>().toBeString();
    });

    it('should map boolean type correctly', () => {
      expectTypeOf<SettingTypeMap['boolean']>().toBeBoolean();
    });

    it('should map number type correctly', () => {
      expectTypeOf<SettingTypeMap['number']>().toBeNumber();
    });

    it('should map object type correctly', () => {
      expectTypeOf<SettingTypeMap['object']>().toEqualTypeOf<Record<string, unknown>>();
    });
  });

  describe('SettingItem generic', () => {
    it('should enforce correct defaultValue type for boolean', () => {
      const boolSetting: SettingItem<'boolean'> = {
        key: 'darkMode',
        type: 'boolean',
        defaultValue: false,
      };

      expectTypeOf(boolSetting.defaultValue).toBeBoolean();
    });

    it('should enforce correct defaultValue type for number', () => {
      const numSetting: SettingItem<'number'> = {
        key: 'fontSize',
        type: 'number',
        defaultValue: 14,
      };

      expectTypeOf(numSetting.defaultValue).toBeNumber();
    });

    it('should enforce correct defaultValue type for string', () => {
      const strSetting: SettingItem<'string'> = {
        key: 'theme',
        type: 'string',
        defaultValue: 'dark',
      };

      expectTypeOf(strSetting.defaultValue).toBeString();
    });
  });

  describe('SettingValue union', () => {
    it('should accept string', () => {
      expectTypeOf<string>().toMatchTypeOf<SettingValue>();
    });

    it('should accept boolean', () => {
      expectTypeOf<boolean>().toMatchTypeOf<SettingValue>();
    });

    it('should accept number', () => {
      expectTypeOf<number>().toMatchTypeOf<SettingValue>();
    });

    it('should accept Record<string, unknown>', () => {
      expectTypeOf<Record<string, unknown>>().toMatchTypeOf<SettingValue>();
    });
  });

  describe('Cashu types', () => {
    it('CashuProof should have correct structure', () => {
      expectTypeOf<CashuProof>().toHaveProperty('amount');
      expectTypeOf<CashuProof>().toHaveProperty('secret');
      expectTypeOf<CashuProof>().toHaveProperty('C');
      expectTypeOf<CashuProof>().toHaveProperty('id');
    });

    it('ProofStateValue should be a union of specific strings', () => {
      expectTypeOf<'UNSPENT'>().toMatchTypeOf<ProofStateValue>();
      expectTypeOf<'SPENT'>().toMatchTypeOf<ProofStateValue>();
      expectTypeOf<'PENDING'>().toMatchTypeOf<ProofStateValue>();
    });

    it('DecodedToken should have correct structure', () => {
      expectTypeOf<DecodedToken>().toHaveProperty('proofs');
      expectTypeOf<DecodedToken>().toHaveProperty('amount');
      expectTypeOf<DecodedToken>().toHaveProperty('mint');
    });

    it('MintQuoteResponse should have correct structure', () => {
      expectTypeOf<MintQuoteResponse>().toHaveProperty('quote');
      expectTypeOf<MintQuoteResponse>().toHaveProperty('request');
      expectTypeOf<MintQuoteResponse>().toHaveProperty('paid');
      expectTypeOf<MintQuoteResponse>().toHaveProperty('expiry');
    });
  });

  describe('Utility types', () => {
    it('Nullable should add null to type', () => {
      expectTypeOf<Nullable<string>>().toEqualTypeOf<string | null>();
    });

    it('Optional should add undefined to type', () => {
      expectTypeOf<Optional<string>>().toEqualTypeOf<string | undefined>();
    });

    it('AsyncFunction should return Promise', () => {
      type TestFn = AsyncFunction<string>;
      expectTypeOf<TestFn>().returns.toEqualTypeOf<Promise<string>>();
    });

    it('ApiResponse should have correct structure', () => {
      expectTypeOf<ApiResponse>().toHaveProperty('success');
      expectTypeOf<ApiResponse<string>>().toHaveProperty('data');
      expectTypeOf<ApiResponse>().toHaveProperty('error');
    });

    it('ApiResponse generic should type data correctly', () => {
      type StringResponse = ApiResponse<string>;
      // data should be string | undefined due to optional
      expectTypeOf<StringResponse['data']>().toEqualTypeOf<string | undefined>();
    });
  });
});
