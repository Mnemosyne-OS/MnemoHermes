import { MnemoCartridgeSDK } from './mnemo-sdk';

// The id must equal the manifest `name`: the sandbox vault is keyed on it.
export const sdk = new MnemoCartridgeSDK('@mnemosyne-plugins/mnemo-hermes');
