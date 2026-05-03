# DUCAT Client SDK

Reference client and SDK for implementing the DUCAT protocol.

## Features

This SDK includes the following modules (in `/src/modules`):

 * `guard  :` A websocket client for transacting with a guardian node.
 * `oracle :` An http request library for fetching data from indexers and oracle servers.
 * `vault  :` The core transaction library for performing vault operations.
 * `wallet :` Reference wallet for the DUCAT protocol.

 This SDK is under heavy development. More features and documentation coming soon.

## Testing & Development

This testing suite includes an internal TAP testing suite, test implementation of a guardian node, and several sets of demo scripts which demonstrate the protocol.

### Running the Test Scripts

The test suite is located in `test/tape`, and can be run using the following command:

```bash
npm run test  ## Using NPM
yarn test     ## Using Yarn
```

There is also a `test/scratch` file that can be run for quick mock-ups and testing:

```bash
npm run scratch  ## Using NPM
yarn scratch     ## Using Yarn
```

For any other scripts, you can run then using the `load` command, followed by the script path:

```bash
npm run load demo/core/open.ts  ## Using NPM
yarn load demo/core/open.ts     ## Using Yarn
```

### Running the Demo Scripts

The demo scripts are located in `demo` and can be run via the following command:

```bash
## Example of running the demo/core/open script using yarn.
yarn load demo/core/open.ts
```

The demo scripts include:
 * `core`: Implements the core vault protocol.
 * `guard`: Implements an e2e interaction between a protocol guardian and client wallet.

 > Note: The demo scripts require the `oracle-infra` environment to be running in the background.

### Running the Test Guardian

You can start a test guardian server for development via the script `yarn start:guardian`.

By default, the guardian will be listening for websocket requests at `http://localhost:8081`.

### Running the Test Price Oracle

You can start a price oracle server for development via the script `yarn start:exchange`.

By default, the price server will be listening for HTTP requests at `http://localhost:8082`.

## Resources

**Oracle Infra**  

The on-chain contract and oracle infrastructure required for the protocol.  

https://github.com/DUCAT-UNIT/oracle-infra

**Guardian**  

The validation nodes responsible for guarding the mint and vaults.

https://github.com/DUCAT-UNIT/guardian
