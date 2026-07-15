import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

// Payable values must match contracts/gen_squat_core.py
export const PAYABLE = {
  submitClaim: 5n * 10n ** 18n,   // 5 GEN
  disputeClaim: 10n * 10n ** 18n, // 10 GEN
  mintNft: 2n * 10n ** 18n,       // 2 GEN
};

export const EXPECTED_METHODS = [
  'submit_claim',
  'analyze_claim',
  'dispute_claim',
  'mint_boundary_nft',
  'get_claim',
  'get_ruling',
  'get_claim_count',
  'get_boundary_nft',
  'get_contract_info',
];

const ZERO = '0x0000000000000000000000000000000000000000';
const rawAddress = String(import.meta.env.VITE_CONTRACT_ADDRESS ?? '').trim();
const rawRpc = String(
  import.meta.env.VITE_GENLAYER_RPC ?? 'https://studio.genlayer.com/api'
).trim();

export const CONTRACT_ADDRESS = rawAddress || ZERO;
export const RPC_URL = rawRpc || 'https://studio.genlayer.com/api';

export const config = {
  product: 'GenSquat',
  contractAddress: CONTRACT_ADDRESS,
  rpcUrl: RPC_URL,
  networkLabel: 'GenLayer Studionet',
  sourcePath: 'contracts/gen_squat_core.py',
  githubRepo: 'https://github.com/phu1271997/gen-squat',
  liveApp: 'https://gen-squat.vercel.app',
  isConfigured:
    Boolean(rawAddress) &&
    rawAddress.toLowerCase() !== ZERO.toLowerCase() &&
    rawAddress.startsWith('0x') &&
    rawAddress.length === 42,
  payable: {
    submit_claim: '5 GEN',
    dispute_claim: '10 GEN',
    mint_boundary_nft: '2 GEN',
  },
  explorerUrl:
    rawAddress && rawAddress !== ZERO
      ? `https://explorer-studio.genlayer.com/address/${rawAddress}`
      : '',
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
  chain: studionet,
  endpoint: RPC_URL,
  account: account,
});

export function requireContract(address) {
  const addr = address || CONTRACT_ADDRESS;
  if (!addr || addr === ZERO || addr.length !== 42) {
    throw new Error(
      'VITE_CONTRACT_ADDRESS is not configured. Deploy contracts/gen_squat_core.py and set the address on Vercel / Developer Settings.'
    );
  }
  return addr;
}

export async function healthCheck(address) {
  try {
    const addr = requireContract(address);
    const count = await client.readContract({
      address: addr,
      functionName: 'get_claim_count',
      args: [],
    });
    let info = null;
    try {
      const raw = await client.readContract({
        address: addr,
        functionName: 'get_contract_info',
        args: [],
      });
      info = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      // older deploy without get_contract_info
    }
    return {
      ok: true,
      message: `Live GenLayer binding OK · get_claim_count() = ${count}${
        info?.name ? ` · ${info.name}` : ''
      }`,
      count: Number(count),
      info,
    };
  } catch (e) {
    return {
      ok: false,
      message: e?.message || String(e),
    };
  }
}

console.log('GenSquat client initialized with address:', account.address);
console.log('Target smart contract address:', CONTRACT_ADDRESS);
