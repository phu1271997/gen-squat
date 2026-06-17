import React, { createContext, useState, useEffect } from 'react';
import { client, account, CONTRACT_ADDRESS as INITIAL_CORE_ADDRESS } from '../genlayerClient';
import { TransactionStatus } from 'genlayer-js/types';

export const GenSquatContext = createContext();

const PRESEEDED_CLAIMS = {
  demo_hcmc: {
    id: "demo_hcmc",
    owner: "0x2bd806c97F0e00aF1a1fC3328fA763a9269723C8",
    polygon: [[10.7769, 106.7009], [10.7775, 106.7009], [10.7775, 106.7015], [10.7769, 106.7015]],
    year_start: 2015,
    year_end: 2025,
    description: "My family's residential plot in District 2, HCMC. Neighbor has rebuilt their fence over the years, seemingly pushing eastwards into my property boundary.",
    status: "ANALYZED",
    area_m2: 660,
    created_at: 1700006400,
    analyzed_at: 1700006500,
    ruling: {
      encroachment_detected: true,
      area_lost_m2: 55,
      confidence: "0.94",
      timeline: [
        { year: 2015, event: "Fence built on legal boundary" },
        { year: 2019, event: "Neighbor clears trees on buffer zone" },
        { year: 2022, event: "New concrete fence construction pushed east" }
      ],
      evidence_urls: [
        "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2B_MSIL2A_2015",
        "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2A_MSIL2A_2025"
      ],
      reasoning: "Visual comparisons between Sentinel-2 time series (2015-2025) and OSM Overpass historical tags indicate a clear shift of the residential perimeter wall eastwards by approx 1.8 meters. The canopy cover decrease on the claimant's side correlates with neighbor's concrete pad construction."
    },
    dispute: null,
    dispute_ruling: null,
    nft_minted: true,
    nft_token_id: "sbt_demo_hcmc"
  },
  demo_hanoi: {
    id: "demo_hanoi",
    owner: "0xdC18Aa3db8bc91A6E390A35e7D0811246fF3aB01",
    polygon: [[21.0285, 105.8542], [21.0295, 105.8542], [21.0295, 105.8552], [21.0285, 105.8552]],
    year_start: 2018,
    year_end: 2024,
    description: "A commercial plot located in Hoan Kiem District. Seeking official boundary verification before starting design phases for a commercial storefront.",
    status: "ANALYZED",
    area_m2: 12100,
    created_at: 1700007400,
    analyzed_at: 1700007500,
    ruling: {
      encroachment_detected: false,
      area_lost_m2: 0,
      confidence: "0.98",
      timeline: [
        { year: 2018, event: "Storefront registered" },
        { year: 2024, event: "Physical review matches digital registry" }
      ],
      evidence_urls: [
        "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2_Hanoi_2018",
        "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2_Hanoi_2024"
      ],
      reasoning: "Historical imagery indicates no boundary modification or physical expansion. Overpass API registry matches perfectly with current physical fence layout. No structural changes detected."
    },
    dispute: null,
    dispute_ruling: null,
    nft_minted: false,
    nft_token_id: null
  },
  demo_daklak: {
    id: "demo_daklak",
    owner: "0x2bd806c97F0e00aF1a1fC3328fA763a9269723C8",
    polygon: [[12.6712, 108.0382], [12.6722, 108.0382], [12.6722, 108.0392], [12.6712, 108.0392]],
    year_start: 2016,
    year_end: 2025,
    description: "Agricultural coffee farm boundary. Suspect neighboring plantation has cleared trees and expanded road lanes inside our eastern boundary coordinates.",
    status: "DISPUTED",
    area_m2: 12100,
    created_at: 1700008400,
    analyzed_at: 1700008500,
    ruling: {
      encroachment_detected: false,
      area_lost_m2: 0,
      confidence: "0.65",
      timeline: [
        { year: 2016, event: "Farm setup" }
      ],
      evidence_urls: [
        "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2_Daklak_2016"
      ],
      reasoning: "Moderate cloud cover and shadow offsets in historical Sentinel-2 data (2016-2025) limit clear fence visibility. No major deviation verified."
    },
    dispute: {
      challenger: "0xdC18Aa3db8bc91A6E390A35e7D0811246fF3aB01",
      reason: "The initial analysis used low-res filters. The neighbor cleared tree canopy on the eastern buffer lane which is visible if using the red-edge band spectral analysis.",
      created_at: 1700008600
    },
    dispute_ruling: {
      dispute_verdict: "OVERTURN",
      encroachment_detected: true,
      area_lost_m2: 112,
      confidence: "0.92",
      reasoning: "High-resolution red-edge band comparison confirms canopy removal on claimant's side of boundary starting mid-2021. Neighbors widened agricultural road by 3 meters inside claimant's polygon."
    },
    nft_minted: false,
    nft_token_id: null
  }
};

export const GenSquatProvider = ({ children }) => {
  const [mode, setMode] = useState(() => localStorage.getItem('gensquat_mode') || 'DEMO');
  const [coreAddress, setCoreAddress] = useState(() => localStorage.getItem('gensquat_core_address') || INITIAL_CORE_ADDRESS || '');
  const [treasuryAddress, setTreasuryAddress] = useState(() => localStorage.getItem('gensquat_treasury_address') || '');
  const [nftAddress, setNftAddress] = useState(() => localStorage.getItem('gensquat_nft_address') || '');
  
  // Demo states
  const [demoBalance, setDemoBalance] = useState(() => parseFloat(localStorage.getItem('gensquat_demo_balance') || '25.0'));
  const [demoClaims, setDemoClaims] = useState(() => {
    const saved = localStorage.getItem('gensquat_claims');
    return saved ? JSON.parse(saved) : PRESEEDED_CLAIMS;
  });
  const [demoSurplus, setDemoSurplus] = useState(15.0);
  const [demoLocked, setDemoLocked] = useState(15.0);
  const [demoWithdrawable, setDemoWithdrawable] = useState(5.0);
  const [demoReputation, setDemoReputation] = useState(100);

  // Live states
  const [liveBalance, setLiveBalance] = useState(0);

  useEffect(() => {
    localStorage.setItem('gensquat_mode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('gensquat_core_address', coreAddress);
  }, [coreAddress]);

  useEffect(() => {
    localStorage.setItem('gensquat_claims', JSON.stringify(demoClaims));
  }, [demoClaims]);

  useEffect(() => {
    localStorage.setItem('gensquat_demo_balance', demoBalance.toString());
  }, [demoBalance]);

  // Sync balances in RPC mode
  useEffect(() => {
    if (mode === 'RPC') {
      const fetchLiveBalance = async () => {
        try {
          const bal = await client.getBalance({ address: account.address });
          // Convert from Wei to GEN (10^18)
          setLiveBalance(parseFloat(bal) / 1e18);
        } catch (e) {
          console.error("Failed to fetch RPC balance:", e);
        }
      };
      fetchLiveBalance();
      const interval = setInterval(fetchLiveBalance, 10000);
      return () => clearInterval(interval);
    }
  }, [mode]);

  // Demo auto-faucet
  const faucet = () => {
    if (mode === 'DEMO') {
      setDemoBalance(prev => prev + 10);
      return { success: true, amount: 10 };
    }
    return { success: false, error: "Faucet only available in Demo Mode" };
  };

  const getBalance = () => {
    return mode === 'DEMO' ? demoBalance : liveBalance;
  };

  const submitClaim = async (polygon, startYear, endYear, description) => {
    if (mode === 'DEMO') {
      if (demoBalance < 5.0) {
        throw new Error("Insufficient GEN balance. Please use Faucet!");
      }
      setDemoBalance(prev => prev - 5.0);
      setDemoLocked(prev => prev + 5.0);

      const claimId = `claim_${Date.now()}`;
      const newClaim = {
        id: claimId,
        owner: account.address,
        polygon: JSON.parse(polygon),
        year_start: parseInt(startYear),
        year_end: parseInt(endYear),
        description,
        status: "SUBMITTED",
        area_m2: Math.floor(500 + Math.random() * 800),
        created_at: Math.floor(Date.now() / 1000),
        analyzed_at: null,
        ruling: null,
        dispute: null,
        dispute_ruling: null,
        nft_minted: false,
        nft_token_id: null
      };

      setDemoClaims(prev => ({
        ...prev,
        [claimId]: newClaim
      }));

      return claimId;
    } else {
      // RPC Mode write transaction
      const txHash = await client.writeContract({
        address: coreAddress,
        functionName: 'submit_claim',
        args: [polygon, parseInt(startYear), parseInt(endYear), description],
        value: 5n * 10n**18n // 5 GEN in wei
      });
      const receipt = await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.FINALIZED
      });
      // Query claim count
      const latestCount = await client.readContract({
        address: coreAddress,
        functionName: 'claim_count',
        args: []
      });
      return `claim_${latestCount}`;
    }
  };

  const analyzeClaim = async (claimId, onProgress) => {
    if (mode === 'DEMO') {
      const steps = ['PROPOSING', 'COMMITTING', 'REVEALING', 'FINALIZED'];
      for (const step of steps) {
        onProgress(step);
        await new Promise(r => setTimeout(r, 800));
      }

      setDemoClaims(prev => {
        const claim = prev[claimId];
        if (!claim) return prev;
        
        // Enforce preset AI outcomes or generate random
        const isEncroaching = claim.description.toLowerCase().includes('encroach') || Math.random() > 0.4;
        const confidence = (0.7 + Math.random() * 0.28).toFixed(2);
        const areaLost = isEncroaching ? Math.floor(30 + Math.random() * 100) : 0;
        
        const ruling = {
          encroachment_detected: isEncroaching,
          area_lost_m2: areaLost,
          confidence,
          timeline: [
            { year: claim.year_start, event: "Baseline forest/canopy density analyzed via STAC" },
            { year: claim.year_start + Math.floor((claim.year_end - claim.year_start)/2), event: "Potential structural clearing or vegetation removal detected" },
            { year: claim.year_end, event: "Final deviation boundary verified via OSM Overpass attic" }
          ],
          evidence_urls: [
            `https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2_${claimId}_start`,
            `https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2_${claimId}_end`
          ],
          reasoning: isEncroaching 
            ? `Democratic consensus has resolved that encroachment occurred. Spectral analysis confirms vegetation replacement by impervious surface within the claim coordinates starting year ${claim.year_start + 2}.`
            : "Consensus verified that current physical features align with historical boundary descriptions. No encroachment detected."
        };

        return {
          ...prev,
          [claimId]: {
            ...claim,
            status: "ANALYZED",
            analyzed_at: Math.floor(Date.now() / 1000),
            ruling
          }
        };
      });

      return;
    } else {
      // RPC Mode write transaction
      const txHash = await client.writeContract({
        address: coreAddress,
        functionName: 'analyze_claim',
        args: [claimId]
      });
      
      const interval = setInterval(async () => {
        try {
          const tx = await client.getTransaction({ hash: txHash });
          onProgress(tx.status);
        } catch (err) {}
      }, 1500);

      await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.FINALIZED
      });

      clearInterval(interval);
    }
  };

  const claimRefund = async (claimId) => {
    if (mode === 'DEMO') {
      const claim = demoClaims[claimId];
      if (!claim || claim.status !== 'ANALYZED') return;
      const conf = parseFloat(claim.ruling.confidence);
      const refund = conf >= 0.7 ? 5.0 : 2.5;
      
      setDemoLocked(prev => prev - 5.0);
      setDemoWithdrawable(prev => prev + refund);
      if (refund < 5.0) {
        setDemoSurplus(prev => prev + (5.0 - refund));
      }

      setDemoClaims(prev => ({
        ...prev,
        [claimId]: {
          ...claim,
          status: "REFUNDED"
        }
      }));
    } else {
      const txHash = await client.writeContract({
        address: coreAddress,
        functionName: 'claim_refund',
        args: [claimId]
      });
      await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.FINALIZED
      });
    }
  };

  const disputeClaim = async (claimId, reason, onProgress) => {
    if (mode === 'DEMO') {
      if (demoBalance < 10.0) {
        throw new Error("Insufficient GEN balance to lock 10 GEN dispute stake.");
      }
      setDemoBalance(prev => prev - 10.0);
      setDemoLocked(prev => prev + 10.0);

      const steps = ['PROPOSING', 'COMMITTING', 'REVEALING', 'FINALIZED'];
      for (const step of steps) {
        onProgress(step);
        await new Promise(r => setTimeout(r, 800));
      }

      setDemoClaims(prev => {
        const claim = prev[claimId];
        if (!claim) return prev;

        const isOverturned = Math.random() > 0.3; // 70% chance of overturning ruling on appeal
        
        const dispute = {
          challenger: account.address,
          reason,
          created_at: Math.floor(Date.now() / 1000)
        };

        const dispute_ruling = {
          dispute_verdict: isOverturned ? "OVERTURN" : "UPHOLD",
          encroachment_detected: isOverturned ? !claim.ruling.encroachment_detected : claim.ruling.encroachment_detected,
          area_lost_m2: isOverturned ? (claim.ruling.encroachment_detected ? 0 : Math.floor(50 + Math.random()*50)) : claim.ruling.area_lost_m2,
          confidence: (0.85 + Math.random() * 0.13).toFixed(2),
          reasoning: isOverturned
            ? `Democratic arbitration has OVERTURNED the initial verdict. High-resolution multi-spectral analysis resolves that the initial verdict missed minor boundary alterations due to pixel shadows. Corrected verdict stands.`
            : `Democratic arbitration has UPHELD the initial verdict. The claimant's dispute grounds lacked corroborative spectral shift signatures.`
        };

        // Tokenomics:
        setDemoLocked(prevLocked => prevLocked - 15.0); // 5 claim stake + 10 dispute stake
        if (isOverturned) {
          // Challenger wins: gets their 10 stake back + 2.5 GEN reward (50% of claimant's 5 GEN stake).
          // Remainder of claimant's stake (2.5 GEN) goes to surplus.
          setDemoWithdrawable(prev => prev + 12.5);
          setDemoSurplus(prev => prev + 2.5);
        } else {
          // Challenger loses: 10 stake split: 5 GEN to claim owner, 5 GEN to surplus.
          // Claim owner also gets refund of their claim stake (since initial ruling upheld) = 5 GEN.
          // Total claim owner withdrawable: 5 + 5 = 10 GEN.
          setDemoWithdrawable(prev => prev + 10.0); // Assume claim owner is user for simplicity of balance demo
          setDemoSurplus(prev => prev + 5.0);
        }

        return {
          ...prev,
          [claimId]: {
            ...claim,
            status: "DISPUTED",
            dispute,
            dispute_ruling
          }
        };
      });

      return;
    } else {
      // RPC Mode write transaction
      const txHash = await client.writeContract({
        address: coreAddress,
        functionName: 'dispute_claim',
        args: [claimId, reason],
        value: 10n * 10n**18n // 10 GEN in wei
      });

      const interval = setInterval(async () => {
        try {
          const tx = await client.getTransaction({ hash: txHash });
          onProgress(tx.status);
        } catch (err) {}
      }, 1500);

      await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.FINALIZED
      });

      clearInterval(interval);
    }
  };

  const mintNft = async (claimId) => {
    if (mode === 'DEMO') {
      if (demoBalance < 2.0) {
        throw new Error("Insufficient GEN balance to mint SBT. Minting fee: 2 GEN.");
      }
      setDemoBalance(prev => prev - 2.0);
      setDemoSurplus(prev => prev + 2.0);

      setDemoClaims(prev => {
        const claim = prev[claimId];
        if (!claim) return prev;
        return {
          ...prev,
          [claimId]: {
            ...claim,
            nft_minted: true,
            nft_token_id: `sbt_${claimId}`
          }
        };
      });

      return `sbt_${claimId}`;
    } else {
      // RPC Mode write transaction
      const txHash = await client.writeContract({
        address: coreAddress,
        functionName: 'mint_boundary_nft',
        args: [claimId],
        value: 2n * 10n**18n // 2 GEN in wei
      });
      await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.FINALIZED
      });
      return `sbt_${claimId}`;
    }
  };

  const withdrawFunds = async () => {
    if (mode === 'DEMO') {
      if (demoWithdrawable <= 0) {
        throw new Error("No withdrawable balance available.");
      }
      const amount = demoWithdrawable;
      setDemoWithdrawable(0);
      setDemoBalance(prev => prev + amount);
      return amount;
    } else {
      const txHash = await client.writeContract({
        address: treasuryAddress,
        functionName: 'withdraw'
      });
      await client.waitForTransactionReceipt({
        hash: txHash,
        status: TransactionStatus.FINALIZED
      });
      return "Success";
    }
  };

  const getTreasuryStats = async () => {
    if (mode === 'DEMO') {
      return {
        surplus_pool: demoSurplus,
        total_locked: demoLocked
      };
    } else {
      try {
        const statsStr = await client.readContract({
          address: treasuryAddress,
          functionName: 'get_treasury_stats',
          args: []
        });
        const parsed = JSON.parse(statsStr);
        return {
          surplus_pool: parsed.surplus_pool / 1e18,
          total_locked: parsed.total_locked / 1e18
        };
      } catch (e) {
        console.error("Failed to read treasury stats:", e);
        return { surplus_pool: 0, total_locked: 0 };
      }
    }
  };

  const getUserReputation = async (userAddress) => {
    if (mode === 'DEMO') {
      return demoReputation;
    } else {
      try {
        const rep = await client.readContract({
          address: coreAddress,
          functionName: 'get_reputation',
          args: [userAddress || account.address]
        });
        return Number(rep);
      } catch (e) {
        console.error("Failed to read reputation:", e);
        return 100; // Default reputation
      }
    }
  };

  const getWithdrawableBalance = async (userAddress) => {
    if (mode === 'DEMO') {
      return demoWithdrawable;
    } else {
      try {
        const bal = await client.readContract({
          address: treasuryAddress,
          functionName: 'get_balance',
          args: [userAddress || account.address]
        });
        return parseFloat(bal) / 1e18;
      } catch (e) {
        console.error("Failed to read withdrawable balance:", e);
        return 0;
      }
    }
  };

  // Helper to read claim details
  const getClaimDetails = async (id) => {
    if (mode === 'DEMO') {
      const claim = demoClaims[id];
      if (!claim) throw new Error("Claim not found");
      return claim;
    } else {
      // Real RPC contract query
      const claimStr = await client.readContract({
        address: coreAddress,
        functionName: 'get_claim',
        args: [id]
      });
      const claim = JSON.parse(claimStr);

      // Fetch optional ruling
      let ruling = null;
      try {
        const rulingStr = await client.readContract({
          address: coreAddress,
          functionName: 'get_claim_ruling',
          args: [id]
        });
        ruling = JSON.parse(rulingStr);
      } catch (e) {}

      // Fetch optional dispute
      let dispute = null;
      try {
        const disputeStr = await client.readContract({
          address: coreAddress,
          functionName: 'get_claim_dispute',
          args: [id]
        });
        dispute = JSON.parse(disputeStr);
      } catch (e) {}

      // Fetch optional dispute ruling
      let dispute_ruling = null;
      try {
        const disputeRulingStr = await client.readContract({
          address: coreAddress,
          functionName: 'get_dispute_ruling',
          args: [id]
        });
        dispute_ruling = JSON.parse(disputeRulingStr);
      } catch (e) {}

      // Fetch optional NFT
      let nft_minted = false;
      let nft_token_id = null;
      try {
        const nftStr = await client.readContract({
          address: nftAddress,
          functionName: 'get_nft',
          args: [id]
        });
        if (nftStr) {
          nft_minted = true;
          nft_token_id = `sbt_${id}`;
        }
      } catch (e) {}

      return {
        ...claim,
        ruling,
        dispute,
        dispute_ruling,
        nft_minted,
        nft_token_id
      };
    }
  };

  return (
    <GenSquatContext.Provider value={{
      mode,
      setMode,
      account,
      coreAddress,
      setCoreAddress,
      treasuryAddress,
      setTreasuryAddress,
      nftAddress,
      setNftAddress,
      getBalance,
      faucet,
      submitClaim,
      analyzeClaim,
      claimRefund,
      disputeClaim,
      mintNft,
      withdrawFunds,
      getTreasuryStats,
      getUserReputation,
      getWithdrawableBalance,
      getClaimDetails,
      claims: mode === 'DEMO' ? Object.values(demoClaims) : []
    }}>
      {children}
    </GenSquatContext.Provider>
  );
};
