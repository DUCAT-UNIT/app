/**
 * TransactionItem Component
 * Displays a single transaction in the history list
 */

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import VaultTransactionItem from './VaultTransactionItem';
import EcashTransactionItem from './EcashTransactionItem';
import RegularTransactionItem from './RegularTransactionItem';

function TransactionItem({ tx, styles, onPress, advancedMode = false }) {
  if (tx.vaultTransaction) {
    return <VaultTransactionItem tx={tx} styles={styles} onPress={onPress} />;
  }

  if (tx.ecashToken) {
    return <EcashTransactionItem tx={tx} styles={styles} onPress={onPress} />;
  }

  return <RegularTransactionItem tx={tx} styles={styles} onPress={onPress} advancedMode={advancedMode} />;
}

TransactionItem.propTypes = {
  tx: PropTypes.object.isRequired,
  styles: PropTypes.object.isRequired,
  onPress: PropTypes.func.isRequired,
  advancedMode: PropTypes.bool,
};

export default memo(TransactionItem, (prev, next) => {
  return (
    prev.tx.txid === next.tx.txid &&
    prev.tx.status?.confirmed === next.tx.status?.confirmed &&
    prev.advancedMode === next.advancedMode &&
    prev.onPress === next.onPress
  );
});
