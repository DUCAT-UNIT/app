# @ducat-unit/runestone

TypeScript implementation of the Bitcoin Runestone protocol used by DUCAT packages.

This package intentionally focuses on runestone encoding/decoding primitives consumed by
`core-ts`, `bootstrap-ts`, and `validator-ts`.

## Encode Runestone

To encode a runestone, use `encodeRunestone()` method, with an example below:

```ts
import { encodeRunestone } from '@ducat-unit/runestone';

// To deploy a new rune ticker
// (this will require a commitment in an input script)
const etchingRunestone = encodeRunestone({
  etching: {
    runeName: 'THIS•IS•AN•EXAMPLE•RUNE',
    divisibility: 0,
    premine: 0,
    symbol: '',
    terms: {
      cap: 69,
      amount: 420,
      offset: {
        end: 9001,
      },
    },
    turbo: true,
  },
});

// To mint UNCOMMON•GOODS
const mintRunestone = encodeRunestone({
  mint: {
    block: 1n,
    tx: 0,
  },
});

// Transfer 10 UNCOMMON•GOODS to output 1
const edictRunestone = encodeRunestone({
  edicts: [
    {
      id: {
        block: 1n,
        tx: 0,
      },
      amount: 10n,
      output: 1,
    },
  ],
});
```

## Decode Runestone

Decoding a runestone within a transaction is as simple as passing in
the transaction data from Bitcoin Core RPC server.

```ts
import {
  tryDecodeRunestone,
  isRunestone,
  RunestoneSpec,
  Cenotaph
} from '@ducat-unit/runestone';

// transaction retrieved with getrawtransaction RPC call
const tx = ...;

const artifact = tryDecodeRunestone(tx);

if (isRunestone(artifact)) {
  const runestone: RunestoneSpec = artifact;
  ...
} else {
  const cenotaph: Cenotaph = artifact;
  ...
}
```

## Exported API

- `encodeRunestone(runestone: RunestoneSpec)`
- `tryDecodeRunestone(tx: RunestoneTx)`
- `isRunestone(artifact)`
- Types: `RunestoneSpec`, `Cenotaph`, `Flaw`
