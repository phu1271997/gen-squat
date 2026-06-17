import { createClient } from 'genlayer-js';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

// Define the custom GenLayer Studio network
const studioChain = {
  id: 61999,
  name: 'GenLayer Studio Net',
  nativeCurrency: {
    decimals: 18,
    name: 'GEN',
    symbol: 'GEN',
  },
  rpcUrls: {
    default: { http: ['https://studio.genlayer.com/api'] },
  },
};

// Setup persistent account in localStorage for the user
const getStoredAccount = () => {
  let pkey = localStorage.getItem('gensquat_private_key');
  if (!pkey) {
    pkey = generatePrivateKey();
    localStorage.setItem('gensquat_private_key', pkey);
  }
  try {
    return {
      account: privateKeyToAccount(pkey),
      privateKey: pkey,
    };
  } catch (e) {
    // Fallback if stored key is corrupt
    const newPkey = generatePrivateKey();
    localStorage.setItem('gensquat_private_key', newPkey);
    return {
      account: privateKeyToAccount(newPkey),
      privateKey: newPkey,
    };
  }
};

export const { account, privateKey } = getStoredAccount();

export const client = createClient({
  chain: studioChain,
  account: account,
});

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

console.log('GenSquat client initialized with address:', account.address);
console.log('Target smart contract address:', CONTRACT_ADDRESS);
