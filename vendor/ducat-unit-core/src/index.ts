/**
 * @fileoverview Core package top-level export surface.
 */

import * as CONST    from './const.js'
import * as LIB      from './lib/index.js'
import * as PSBT     from './psbt/index.js'
import * as SCHEMA   from './schema/index.js'
import * as VALIDATE from './validate/index.js'

export { CONST, LIB, PSBT, SCHEMA, VALIDATE }

export * from './class/rpc.js'
// GuardianSigner is exported by name (NOT `export *`) so the module-private
// `read_signer_seckey` accessor in the same file stays off the public surface
// (Codex F06). The signing helper functions it wires live on the `@/lib`
// barrel; they operate over a signer instance and never expose the key.
export { GuardianSigner } from './class/cosigner.js'
export * from './types/index.js'
