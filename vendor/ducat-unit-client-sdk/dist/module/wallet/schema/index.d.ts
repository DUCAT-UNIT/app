declare const _default: {
    config: {
        open_config: import("zod").ZodObject<{
            borrow_amount: import("zod").ZodNumber;
            deposit_amount: import("zod").ZodNumber;
            tx_feerate: import("zod").ZodNumber;
            vault_label: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            tx_feerate: number;
            borrow_amount: number;
            deposit_amount: number;
            vault_label: string;
        }, {
            tx_feerate: number;
            borrow_amount: number;
            deposit_amount: number;
            vault_label: string;
        }>;
        borrow_config: import("zod").ZodObject<{
            borrow_amount: import("zod").ZodNumber;
            deposit_amount: import("zod").ZodNumber;
            tx_feerate: import("zod").ZodNumber;
        }, "strip", import("zod").ZodTypeAny, {
            tx_feerate: number;
            borrow_amount: number;
            deposit_amount: number;
        }, {
            tx_feerate: number;
            borrow_amount: number;
            deposit_amount: number;
        }>;
        repay_config: import("zod").ZodObject<{
            deposit_amount: import("zod").ZodNumber;
            repay_amount: import("zod").ZodNumber;
            tx_feerate: import("zod").ZodNumber;
        }, "strip", import("zod").ZodTypeAny, {
            tx_feerate: number;
            deposit_amount: number;
            repay_amount: number;
        }, {
            tx_feerate: number;
            deposit_amount: number;
            repay_amount: number;
        }>;
        repo_config: import("zod").ZodObject<{
            deposit_amount: import("zod").ZodNumber;
            tx_feerate: import("zod").ZodNumber;
        }, "strip", import("zod").ZodTypeAny, {
            tx_feerate: number;
            deposit_amount: number;
        }, {
            tx_feerate: number;
            deposit_amount: number;
        }>;
        deposit_config: import("zod").ZodObject<{
            deposit_amount: import("zod").ZodNumber;
            tx_feerate: import("zod").ZodNumber;
        }, "strip", import("zod").ZodTypeAny, {
            tx_feerate: number;
            deposit_amount: number;
        }, {
            tx_feerate: number;
            deposit_amount: number;
        }>;
        withdraw_config: import("zod").ZodObject<{
            change_amount: import("zod").ZodNumber;
            tx_feerate: import("zod").ZodNumber;
        }, "strip", import("zod").ZodTypeAny, {
            tx_feerate: number;
            change_amount: number;
        }, {
            tx_feerate: number;
            change_amount: number;
        }>;
    };
    req: {
        open_req: import("zod").ZodObject<{
            tx_feerate: import("zod").ZodNumber;
            vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
            vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
            vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
            vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<false>;
                event_origin: import("zod").ZodNull;
                event_price: import("zod").ZodNull;
                event_stamp: import("zod").ZodNull;
                thold_key: import("zod").ZodNull;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }>, import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<true>;
                event_origin: import("zod").ZodString;
                event_price: import("zod").ZodNumber;
                event_stamp: import("zod").ZodNumber;
                thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }>]>;
            acct_id: import("zod").ZodString;
            acct_utxo: import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                script: string;
            }, {
                value: number;
                txid: string;
                vout: number;
                script: string;
            }>;
            borrow_amount: import("zod").ZodNumber;
            connect_input: import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }>;
            deposit_amount: import("zod").ZodNumber;
            sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
            sats_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }>, "many">;
            unit_address: import("zod").ZodString;
            unit_postage: import("zod").ZodNumber;
            token_address: import("zod").ZodString;
            token_data: import("zod").ZodObject<{
                rev: import("zod").ZodNumber;
                tag: import("zod").ZodString;
                ver: import("zod").ZodNumber;
            }, "strip", import("zod").ZodTypeAny, {
                rev: number;
                tag: string;
                ver: number;
            }, {
                rev: number;
                tag: string;
                ver: number;
            }>;
            token_postage: import("zod").ZodNumber;
            issue_psbt: import("zod").ZodOptional<import("zod").ZodString>;
            issue_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
            issue_txid: import("zod").ZodEffects<import("zod").ZodString, string, string>;
        } & {
            contract_id: import("zod").ZodString;
            network: import("zod").ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
        }, "strip", import("zod").ZodTypeAny, {
            acct_id: string;
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            sats_address: string;
            tx_feerate: number;
            borrow_amount: number;
            deposit_amount: number;
            token_address: string;
            token_data: {
                rev: number;
                tag: string;
                ver: number;
            };
            token_postage: number;
            unit_address: string;
            unit_postage: number;
            vault_pubkey: string;
            acct_utxo: {
                value: number;
                txid: string;
                vout: number;
                script: string;
            };
            contract_id: string;
            vault_quote: {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            } | {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            };
            vault_txid: string;
            connect_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            sats_inputs: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }[];
            issue_txid: string;
            network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
            vault_psbt?: string | undefined;
            vault_txhex?: string | undefined;
            issue_psbt?: string | undefined;
            issue_txhex?: string | undefined;
        }, {
            acct_id: string;
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            sats_address: string;
            tx_feerate: number;
            borrow_amount: number;
            deposit_amount: number;
            token_address: string;
            token_data: {
                rev: number;
                tag: string;
                ver: number;
            };
            token_postage: number;
            unit_address: string;
            unit_postage: number;
            vault_pubkey: string;
            acct_utxo: {
                value: number;
                txid: string;
                vout: number;
                script: string;
            };
            contract_id: string;
            vault_quote: {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            } | {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            };
            vault_txid: string;
            connect_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            sats_inputs: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }[];
            issue_txid: string;
            network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
            vault_psbt?: string | undefined;
            vault_txhex?: string | undefined;
            issue_psbt?: string | undefined;
            issue_txhex?: string | undefined;
        }>;
        borrow_req: import("zod").ZodObject<{
            tx_feerate: import("zod").ZodNumber;
            vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
            vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
            vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
            vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<false>;
                event_origin: import("zod").ZodNull;
                event_price: import("zod").ZodNull;
                event_stamp: import("zod").ZodNull;
                thold_key: import("zod").ZodNull;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }>, import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<true>;
                event_origin: import("zod").ZodString;
                event_price: import("zod").ZodNumber;
                event_stamp: import("zod").ZodNumber;
                thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }>]>;
            acct_id: import("zod").ZodString;
            acct_utxo: import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                script: string;
            }, {
                value: number;
                txid: string;
                vout: number;
                script: string;
            }>;
            borrow_amount: import("zod").ZodNumber;
            connect_input: import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }>;
            deposit_amount: import("zod").ZodNumber;
            issue_psbt: import("zod").ZodOptional<import("zod").ZodString>;
            issue_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
            issue_txid: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
            sats_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }>, "many">;
            unit_address: import("zod").ZodString;
            unit_postage: import("zod").ZodNumber;
            vault_input: import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }>;
        } & {
            contract_id: import("zod").ZodString;
            network: import("zod").ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
        }, "strip", import("zod").ZodTypeAny, {
            acct_id: string;
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            sats_address: string;
            tx_feerate: number;
            borrow_amount: number;
            deposit_amount: number;
            unit_address: string;
            unit_postage: number;
            vault_pubkey: string;
            acct_utxo: {
                value: number;
                txid: string;
                vout: number;
                script: string;
            };
            contract_id: string;
            vault_quote: {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            } | {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            };
            vault_txid: string;
            connect_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            sats_inputs: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }[];
            issue_txid: string;
            vault_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
            vault_psbt?: string | undefined;
            vault_txhex?: string | undefined;
            issue_psbt?: string | undefined;
            issue_txhex?: string | undefined;
        }, {
            acct_id: string;
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            sats_address: string;
            tx_feerate: number;
            borrow_amount: number;
            deposit_amount: number;
            unit_address: string;
            unit_postage: number;
            vault_pubkey: string;
            acct_utxo: {
                value: number;
                txid: string;
                vout: number;
                script: string;
            };
            contract_id: string;
            vault_quote: {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            } | {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            };
            vault_txid: string;
            connect_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            sats_inputs: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }[];
            issue_txid: string;
            vault_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
            vault_psbt?: string | undefined;
            vault_txhex?: string | undefined;
            issue_psbt?: string | undefined;
            issue_txhex?: string | undefined;
        }>;
        repay_req: import("zod").ZodObject<{
            tx_feerate: import("zod").ZodNumber;
            vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
            vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
            vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
            vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<false>;
                event_origin: import("zod").ZodNull;
                event_price: import("zod").ZodNull;
                event_stamp: import("zod").ZodNull;
                thold_key: import("zod").ZodNull;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }>, import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<true>;
                event_origin: import("zod").ZodString;
                event_price: import("zod").ZodNumber;
                event_stamp: import("zod").ZodNumber;
                thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }>]>;
            acct_id: import("zod").ZodString;
            acct_utxo: import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                script: string;
            }, {
                value: number;
                txid: string;
                vout: number;
                script: string;
            }>;
            connect_input: import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }>;
            repay_amount: import("zod").ZodNumber;
            repay_psbt: import("zod").ZodOptional<import("zod").ZodString>;
            repay_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
            repay_txid: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
            sats_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }>, "many">;
            unit_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }>, "many">;
            unit_address: import("zod").ZodString;
            unit_postage: import("zod").ZodNumber;
            vault_input: import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }>;
        } & {
            contract_id: import("zod").ZodString;
            network: import("zod").ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
        }, "strip", import("zod").ZodTypeAny, {
            acct_id: string;
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            sats_address: string;
            tx_feerate: number;
            unit_address: string;
            unit_postage: number;
            vault_pubkey: string;
            repay_amount: number;
            acct_utxo: {
                value: number;
                txid: string;
                vout: number;
                script: string;
            };
            contract_id: string;
            vault_quote: {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            } | {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            };
            vault_txid: string;
            connect_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            sats_inputs: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }[];
            vault_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            repay_txid: string;
            unit_inputs: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }[];
            network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
            vault_psbt?: string | undefined;
            vault_txhex?: string | undefined;
            repay_psbt?: string | undefined;
            repay_txhex?: string | undefined;
        }, {
            acct_id: string;
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            sats_address: string;
            tx_feerate: number;
            unit_address: string;
            unit_postage: number;
            vault_pubkey: string;
            repay_amount: number;
            acct_utxo: {
                value: number;
                txid: string;
                vout: number;
                script: string;
            };
            contract_id: string;
            vault_quote: {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            } | {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            };
            vault_txid: string;
            connect_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            sats_inputs: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }[];
            vault_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            repay_txid: string;
            unit_inputs: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }[];
            network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
            vault_psbt?: string | undefined;
            vault_txhex?: string | undefined;
            repay_psbt?: string | undefined;
            repay_txhex?: string | undefined;
        }>;
        repo_req: import("zod").ZodObject<{
            tx_feerate: import("zod").ZodNumber;
            vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
            vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
            vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
            vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<false>;
                event_origin: import("zod").ZodNull;
                event_price: import("zod").ZodNull;
                event_stamp: import("zod").ZodNull;
                thold_key: import("zod").ZodNull;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }>, import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<true>;
                event_origin: import("zod").ZodString;
                event_price: import("zod").ZodNumber;
                event_stamp: import("zod").ZodNumber;
                thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }>]>;
            connect_input: import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }>;
            deposit_amount: import("zod").ZodNumber;
            liquid_psbt: import("zod").ZodOptional<import("zod").ZodString>;
            liquid_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
            liquid_txid: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            liquid_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            } & {
                repo_portion: import("zod").ZodNumber;
                vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                vault_pubkey: string;
                repo_portion: number;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                vault_pubkey: string;
                repo_portion: number;
                sighash?: string | undefined;
            }>, "many">;
            repo_amount: import("zod").ZodNumber;
            sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
            sats_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }>, "many">;
            vault_input: import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }>;
        } & {
            contract_id: import("zod").ZodString;
            network: import("zod").ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
        }, "strip", import("zod").ZodTypeAny, {
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            sats_address: string;
            tx_feerate: number;
            deposit_amount: number;
            vault_pubkey: string;
            contract_id: string;
            vault_quote: {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            } | {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            };
            vault_txid: string;
            connect_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            sats_inputs: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }[];
            vault_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            liquid_txid: string;
            liquid_inputs: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                vault_pubkey: string;
                repo_portion: number;
                sighash?: string | undefined;
            }[];
            repo_amount: number;
            network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
            vault_psbt?: string | undefined;
            vault_txhex?: string | undefined;
            liquid_psbt?: string | undefined;
            liquid_txhex?: string | undefined;
        }, {
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            sats_address: string;
            tx_feerate: number;
            deposit_amount: number;
            vault_pubkey: string;
            contract_id: string;
            vault_quote: {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            } | {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            };
            vault_txid: string;
            connect_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            sats_inputs: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }[];
            vault_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            liquid_txid: string;
            liquid_inputs: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                vault_pubkey: string;
                repo_portion: number;
                sighash?: string | undefined;
            }[];
            repo_amount: number;
            network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
            vault_psbt?: string | undefined;
            vault_txhex?: string | undefined;
            liquid_psbt?: string | undefined;
            liquid_txhex?: string | undefined;
        }>;
        deposit_req: import("zod").ZodObject<{
            tx_feerate: import("zod").ZodNumber;
            vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
            vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
            vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
            vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<false>;
                event_origin: import("zod").ZodNull;
                event_price: import("zod").ZodNull;
                event_stamp: import("zod").ZodNull;
                thold_key: import("zod").ZodNull;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }>, import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<true>;
                event_origin: import("zod").ZodString;
                event_price: import("zod").ZodNumber;
                event_stamp: import("zod").ZodNumber;
                thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }>]>;
            deposit_amount: import("zod").ZodNumber;
            sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
            sats_inputs: import("zod").ZodArray<import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }>, "many">;
            vault_input: import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }>;
        } & {
            contract_id: import("zod").ZodString;
            network: import("zod").ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
        }, "strip", import("zod").ZodTypeAny, {
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            sats_address: string;
            tx_feerate: number;
            deposit_amount: number;
            vault_pubkey: string;
            contract_id: string;
            vault_quote: {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            } | {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            };
            vault_txid: string;
            sats_inputs: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }[];
            vault_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
            vault_psbt?: string | undefined;
            vault_txhex?: string | undefined;
        }, {
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            sats_address: string;
            tx_feerate: number;
            deposit_amount: number;
            vault_pubkey: string;
            contract_id: string;
            vault_quote: {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            } | {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            };
            vault_txid: string;
            sats_inputs: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }[];
            vault_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
            vault_psbt?: string | undefined;
            vault_txhex?: string | undefined;
        }>;
        withdraw_req: import("zod").ZodObject<{
            tx_feerate: import("zod").ZodNumber;
            vault_action: import("zod").ZodEnum<["o", "b", "r", "d", "w", "x", "l"]>;
            vault_psbt: import("zod").ZodOptional<import("zod").ZodString>;
            vault_txhex: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodString, string, string>>;
            vault_txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_pubkey: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            vault_quote: import("zod").ZodDiscriminatedUnion<"is_expired", [import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<false>;
                event_origin: import("zod").ZodNull;
                event_price: import("zod").ZodNull;
                event_stamp: import("zod").ZodNull;
                thold_key: import("zod").ZodNull;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            }>, import("zod").ZodObject<{
                event_type: import("zod").ZodString;
                latest_origin: import("zod").ZodString;
                latest_price: import("zod").ZodNumber;
                latest_stamp: import("zod").ZodNumber;
                quote_origin: import("zod").ZodString;
                quote_price: import("zod").ZodNumber;
                quote_stamp: import("zod").ZodNumber;
                req_id: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                req_sig: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                srv_network: import("zod").ZodString;
                srv_pubkey: import("zod").ZodEffects<import("zod").ZodString, string, string>;
                thold_hash: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                thold_price: import("zod").ZodNumber;
            } & {
                is_expired: import("zod").ZodLiteral<true>;
                event_origin: import("zod").ZodString;
                event_price: import("zod").ZodNumber;
                event_stamp: import("zod").ZodNumber;
                thold_key: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
            }, "strip", import("zod").ZodTypeAny, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }, {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            }>]>;
            change_amount: import("zod").ZodNumber;
            sats_address: import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodString]>;
            vault_input: import("zod").ZodObject<{
                txid: import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>;
                vout: import("zod").ZodNumber;
                value: import("zod").ZodNumber;
                script: import("zod").ZodEffects<import("zod").ZodString, string, string>;
            } & {
                sighash: import("zod").ZodOptional<import("zod").ZodEffects<import("zod").ZodEffects<import("zod").ZodString, string, string>, string, string>>;
                witness: import("zod").ZodArray<import("zod").ZodEffects<import("zod").ZodString, string, string>, "many">;
            }, "strip", import("zod").ZodTypeAny, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }, {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            }>;
        } & {
            contract_id: import("zod").ZodString;
            network: import("zod").ZodEnum<["main", "testnet3", "testnet4", "mutiny", "regtest", "signet"]>;
        }, "strip", import("zod").ZodTypeAny, {
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            sats_address: string;
            tx_feerate: number;
            vault_pubkey: string;
            change_amount: number;
            contract_id: string;
            vault_quote: {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            } | {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            };
            vault_txid: string;
            vault_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
            vault_psbt?: string | undefined;
            vault_txhex?: string | undefined;
        }, {
            vault_action: "o" | "b" | "r" | "d" | "w" | "x" | "l";
            sats_address: string;
            tx_feerate: number;
            vault_pubkey: string;
            change_amount: number;
            contract_id: string;
            vault_quote: {
                thold_hash: string;
                thold_price: number;
                event_origin: null;
                event_price: null;
                event_stamp: null;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: null;
                is_expired: false;
            } | {
                thold_hash: string;
                thold_price: number;
                event_origin: string;
                event_price: number;
                event_stamp: number;
                event_type: string;
                latest_origin: string;
                latest_price: number;
                latest_stamp: number;
                quote_origin: string;
                quote_price: number;
                quote_stamp: number;
                req_id: string;
                req_sig: string;
                srv_network: string;
                srv_pubkey: string;
                thold_key: string;
                is_expired: true;
            };
            vault_txid: string;
            vault_input: {
                value: number;
                txid: string;
                vout: number;
                witness: string[];
                script: string;
                sighash?: string | undefined;
            };
            network: "main" | "testnet3" | "testnet4" | "mutiny" | "regtest" | "signet";
            vault_psbt?: string | undefined;
            vault_txhex?: string | undefined;
        }>;
    };
};
export default _default;
