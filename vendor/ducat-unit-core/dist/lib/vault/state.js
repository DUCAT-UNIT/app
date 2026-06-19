export function get_vault_state(return_data) {
    const { unit_balance, unit_price } = return_data;
    if (unit_balance === 0 && unit_price === null) {
        return 'cleared';
    }
    if (unit_balance > 0 && unit_price !== null) {
        return 'encumbered';
    }
    return 'empty';
}
export function get_valid_source_states(action) {
    const valid_transitions = {
        'open': ['empty'],
        'deposit': ['cleared', 'encumbered'],
        'borrow': ['cleared', 'encumbered'],
        'repay': ['encumbered'],
        'withdraw': ['cleared', 'encumbered'],
        'close': ['cleared'],
        'liquidate': ['encumbered'],
        'repo': ['encumbered'],
        'trim': ['encumbered']
    };
    return valid_transitions[action];
}
export function is_valid_transition(current_state, action) {
    const allowed = get_valid_source_states(action);
    return allowed.includes(current_state);
}
export function verify_state_transition(current_state, action) {
    const allowed = get_valid_source_states(action);
    if (!allowed.includes(current_state)) {
        throw new Error(`verify_state_transition: cannot ${action} from ${current_state} state (allowed: ${allowed.join(', ')})`);
    }
}
export function verify_vault_action(return_data, action) {
    const current_state = get_vault_state(return_data);
    verify_state_transition(current_state, action);
}
