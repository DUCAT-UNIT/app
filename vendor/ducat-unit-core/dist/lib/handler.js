import { SYMBOLS, TXMAP } from '../const.js';
import * as PSBT from '../psbt/index.js';
import { extract_psbt_tx } from '../psbt/index.js';
export function sign_vault_request_api(guard) {
    return {
        vault_open: sign_vault_open_request_api(guard),
        vault_borrow: sign_vault_borrow_request_api(guard),
        vault_deposit: sign_vault_deposit_request_api(guard),
        vault_close: sign_vault_close_request_api(guard),
        vault_repay: sign_vault_repay_request_api(guard),
        vault_withdraw: sign_vault_withdraw_request_api(guard),
        vault_repo: sign_vault_repo_request_api(guard),
        vault_trim: sign_vault_trim_request_api(guard)
    };
}
function sign_vault_open_request_api(guardian) {
    return (request) => {
        const ISSUE_UNIT_VIN = TXMAP.UNIT_ISSUE.VIN.RESRV;
        const CONN_VAULT_VIN = TXMAP.VAULT_OPEN.VIN.CONN;
        const XFER_UNIT_VIN = TXMAP.VAULT_OPEN.VIN.UNIT;
        let { issue_psbt, vault_psbt } = request;
        issue_psbt = guardian.sign.input.spend(issue_psbt, ISSUE_UNIT_VIN);
        vault_psbt = guardian.sign.input.spend(vault_psbt, XFER_UNIT_VIN);
        vault_psbt = guardian.sign.input.cosign(vault_psbt, CONN_VAULT_VIN);
        const [issue_txid, issue_tx] = extract_psbt_tx(issue_psbt);
        const [vault_txid, vault_tx] = extract_psbt_tx(vault_psbt);
        return { issue_txid, issue_tx, vault_txid, vault_tx };
    };
}
function sign_vault_borrow_request_api(guardian) {
    return (request) => {
        const ISSUE_UNIT_VIN = TXMAP.UNIT_ISSUE.VIN.RESRV;
        const XFER_UNIT_VIN = TXMAP.VAULT_BORROW.VIN.UNIT;
        const SPND_VAULT_VIN = TXMAP.VAULT_BORROW.VIN.VAULT;
        const CONN_VAULT_VIN = TXMAP.VAULT_BORROW.VIN.CONN;
        let { issue_psbt, vault_psbt } = request;
        issue_psbt = guardian.sign.input.spend(issue_psbt, ISSUE_UNIT_VIN);
        vault_psbt = guardian.sign.input.spend(vault_psbt, XFER_UNIT_VIN);
        vault_psbt = guardian.sign.input.cosign(vault_psbt, SPND_VAULT_VIN);
        vault_psbt = guardian.sign.input.cosign(vault_psbt, CONN_VAULT_VIN);
        const [issue_txid, issue_tx] = extract_psbt_tx(issue_psbt);
        const [vault_txid, vault_tx] = extract_psbt_tx(vault_psbt);
        return { issue_txid, issue_tx, vault_txid, vault_tx };
    };
}
function sign_vault_deposit_request_api(guardian) {
    return (request) => {
        const SPND_VAULT_VIN = TXMAP.VAULT_DEPOSIT.VIN.VAULT;
        let { vault_psbt } = request;
        vault_psbt = guardian.sign.input.cosign(vault_psbt, SPND_VAULT_VIN);
        const [vault_txid, vault_tx] = extract_psbt_tx(vault_psbt);
        return { vault_txid, vault_tx };
    };
}
function sign_vault_repay_request_api(guardian) {
    return (request) => {
        const SPND_VAULT_VIN = TXMAP.VAULT_REPAY.VIN.VAULT;
        const CONN_VAULT_VIN = TXMAP.VAULT_REPAY.VIN.CONN;
        let { burn_psbt, vault_psbt } = request;
        vault_psbt = guardian.sign.input.cosign(vault_psbt, SPND_VAULT_VIN);
        vault_psbt = guardian.sign.input.cosign(vault_psbt, CONN_VAULT_VIN);
        const [burn_txid, burn_tx] = extract_psbt_tx(burn_psbt);
        const [vault_txid, vault_tx] = extract_psbt_tx(vault_psbt);
        return { burn_txid, burn_tx, vault_txid, vault_tx };
    };
}
function sign_vault_withdraw_request_api(guardian) {
    return (request) => {
        const SPND_VAULT_VIN = TXMAP.VAULT_WITHDRAW.VIN.VAULT;
        let { vault_psbt } = request;
        vault_psbt = guardian.sign.input.cosign(vault_psbt, SPND_VAULT_VIN);
        const [vault_txid, vault_tx] = extract_psbt_tx(vault_psbt);
        return { vault_txid, vault_tx };
    };
}
function sign_vault_close_request_api(guardian) {
    return (request) => {
        const SPND_VAULT_VIN = TXMAP.VAULT_CLOSE.VIN.VAULT;
        let { vault_psbt } = request;
        vault_psbt = guardian.sign.input.cosign(vault_psbt, SPND_VAULT_VIN);
        const [vault_txid, vault_tx] = extract_psbt_tx(vault_psbt);
        return { vault_txid, vault_tx };
    };
}
function sign_vault_repo_request_api(guardian) {
    return (request) => {
        const vault_psbt = sign_liquid_psbt(guardian, request.vault_psbt);
        const [vault_txid, vault_tx] = extract_psbt_tx(vault_psbt);
        return { vault_txid, vault_tx };
    };
}
function sign_vault_trim_request_api(guardian) {
    return (request) => {
        const vault_psbt = sign_liquid_psbt(guardian, request.vault_psbt);
        const [vault_txid, vault_tx] = extract_psbt_tx(vault_psbt);
        return { vault_txid, vault_tx };
    };
}
function sign_liquid_psbt(guardian, vault_psbt) {
    const pdata = PSBT.parse_psbt(vault_psbt);
    for (let idx = 0; idx < pdata.inputsLength; idx++) {
        const sdata = PSBT.get_psbt_input_sequence(pdata, idx);
        if (!sdata || sdata.type !== 'metadata')
            continue;
        switch (sdata.code) {
            case SYMBOLS.CODE.VAULT.REPO:
            case SYMBOLS.CODE.VAULT.TRIM:
                vault_psbt = guardian.sign.input.cosign(vault_psbt, idx);
                break;
            case SYMBOLS.CODE.INPUT.LIQUID:
                vault_psbt = guardian.sign.input.liquidate(vault_psbt, idx);
                break;
        }
    }
    return vault_psbt;
}
