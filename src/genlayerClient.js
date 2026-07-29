import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

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

// Read the chain id from the SDK — if GenLayer ever bumps it, this follows.
export const STUDIO_CHAIN = studionet;
export const CHAIN_ID_HEX = '0x' + studionet.id.toString(16); // 61999 = 0xF1EF
const NETWORK_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: studionet.name || 'GenLayer Studio Network',
  nativeCurrency: studionet.nativeCurrency || {
    name: 'GEN Token', symbol: 'GEN', decimals: 18,
  },
  rpcUrls: studionet.rpcUrls?.default?.http ?? [RPC_URL],
  blockExplorerUrls: [
    studionet.blockExplorers?.default?.url || 'https://genlayer-explorer.vercel.app',
  ],
};

export const config = {
  product: 'GenSquat',
  contractAddress: CONTRACT_ADDRESS,
  rpcUrl: RPC_URL,
  networkLabel: 'GenLayer Studionet',
  chainIdHex: CHAIN_ID_HEX,
  chainId: studionet.id,
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

// Read-only client (no account). Safe for get_claim / get_ruling / health.
export const readClient = createClient({
  chain: studionet,
  endpoint: RPC_URL,
});

// One signer client per connected address. When account is a STRING, the SDK
// routes eth_sendTransaction / personal_sign through window.ethereum — so the
// user's MetaMask signs and no key ever lives in the bundle (R22).
const signerCache = new Map();
export function getSigner(address) {
  if (!address) {
    throw new Error('Wallet not connected. Click "Connect Wallet" first.');
  }
  const key = address.toLowerCase();
  let signer = signerCache.get(key);
  if (!signer) {
    signer = createClient({
      chain: studionet,
      endpoint: RPC_URL,
      account: address,
    });
    signerCache.set(key, signer);
  }
  return signer;
}

// Kept for pages/context that still reference the old default client.
// New code should use readClient or getSigner(address).
export const client = readClient;

// Legacy stubs — the old DEMO context/pages imported a burner account and its
// private key. That path is removed (R21/R22); these placeholders keep any
// remaining dead-code imports compiling until the files themselves are dropped.
export const account = { address: ZERO };
export const privateKey = '';

function hasProvider() {
  return typeof window !== 'undefined' && !!window.ethereum;
}

export async function switchToStudio() {
  if (!hasProvider()) {
    throw new Error(
      'MetaMask not detected. Install MetaMask, fund the wallet with GEN on GenLayer Studionet (Studio → Accounts panel), then reload.'
    );
  }
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (err) {
    // 4902 = chain not added; -32603 = internal error some wallets throw for same reason
    if (err?.code === 4902 || err?.code === -32603) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [NETWORK_PARAMS],
      });
    } else {
      throw err;
    }
  }
}

export async function connectWallet() {
  if (!hasProvider()) {
    throw new Error(
      'MetaMask not detected. Install MetaMask, fund the wallet with GEN on GenLayer Studionet, then reload.'
    );
  }
  await switchToStudio();
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const addr = accounts?.[0];
  if (!addr) throw new Error('MetaMask returned no account.');
  return addr;
}

export async function getConnectedAddress() {
  if (!hasProvider()) return null;
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    return accounts?.[0] || null;
  } catch {
    return null;
  }
}

export function onAccountsChanged(cb) {
  if (!hasProvider() || typeof window.ethereum.on !== 'function') return () => {};
  const handler = (accounts) => cb(accounts?.[0] || null);
  window.ethereum.on('accountsChanged', handler);
  return () => window.ethereum.removeListener?.('accountsChanged', handler);
}

export function onChainChanged(cb) {
  if (!hasProvider() || typeof window.ethereum.on !== 'function') return () => {};
  const handler = (chainId) => cb(chainId);
  window.ethereum.on('chainChanged', handler);
  return () => window.ethereum.removeListener?.('chainChanged', handler);
}

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
    const count = await readClient.readContract({
      address: addr,
      functionName: 'get_claim_count',
      args: [],
    });
    let info = null;
    try {
      const raw = await readClient.readContract({
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

console.log('GenSquat client initialized · target contract:', CONTRACT_ADDRESS);
console.log('GenSquat network:', config.networkLabel, '·', CHAIN_ID_HEX, '·', RPC_URL);
