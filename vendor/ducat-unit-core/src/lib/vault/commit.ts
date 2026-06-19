/**
 * @fileoverview Vault commit-data encode/decode and config payload validation.
 */

import { Buff }    from '@vbyte/buff'
import * as SCHEMA from '@/schema/index.js'

import { Assert, JsonUtil } from '@vbyte/util'

import type { VaultConfigData, VaultConfigPayload } from '@/types/vault.js'

/** Encode vault config into compact commit payload buffer. */
export function encode_vault_commit_data (
  vault_config : VaultConfigData
) : Buff {
  // Validate the vault config data.
  validate_vault_config_data(vault_config)
  // Return the serialized vault commit data.
  return Buff.json({
    lbl : vault_config.label
  })
}

/** Decode and validate vault config from commit payload JSON string. */
export function decode_vault_commit_data (
  payload : string
) : VaultConfigData {
  // Deserialize the vault config data.
  const json = JsonUtil.parse(payload)
  // Assert that the vault config data is valid.
  Assert.exists(json, 'failed to deserialize vault config data')
  // Validate the vault config payload.
  validate_vault_config_payload(json)
  // Return the deserialized vault config data.
  return {
    label: json.lbl
  }
}

/** Validate full vault config object against schema. */
export function validate_vault_config_data (
  config : unknown
) : asserts config is VaultConfigData {
  // Validate the vault config data.
  SCHEMA.vault.config.parse(config)
}

/** Validate compact vault commit payload shape against schema. */
export function validate_vault_config_payload (
  data : unknown
) : asserts data is VaultConfigPayload {
  // Validate the vault config data.
  SCHEMA.vault.commit.parse(data)
}
