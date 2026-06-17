import { createClient } from 'genlayer-js';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Define custom GenLayer Studio network
const studioChain = {
  id: 61999,
  name: 'GenLayer Studio Net',
  nativeCurrency: { decimals: 18, name: 'GEN', symbol: 'GEN' },
  rpcUrls: { default: { http: ['https://studio.genlayer.com/api'] } },
};

async function main() {
  const pkey = process.env.GENSQUAT_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const coreAddress = process.env.VITE_CONTRACT_ADDRESS || process.argv[2];

  if (!pkey) {
    console.error("Error: GENSQUAT_PRIVATE_KEY or PRIVATE_KEY not found in environment variables.");
    process.exit(1);
  }
  if (!coreAddress) {
    console.error("Error: VITE_CONTRACT_ADDRESS or contract address argument not found.");
    console.error("Usage: node scripts/seed_demo_disputes.js <core_contract_address>");
    process.exit(1);
  }

  const account = privateKeyToAccount(pkey);
  const client = createClient({
    chain: studioChain,
    account: account,
  });

  console.log(`Seeding claims using account: ${account.address}`);
  console.log(`Target Core Contract: ${coreAddress}`);

  // Seed HCMC (Encroachment)
  const hcmcPolygon = JSON.stringify([[10.7769, 106.7009], [10.7775, 106.7009], [10.7775, 106.7015], [10.7769, 106.7015]]);
  console.log("\n1. Submitting District 2 HCMC Claim (5 GEN)...");
  try {
    const tx1 = await client.writeContract({
      address: coreAddress,
      functionName: 'submit_claim',
      args: [hcmcPolygon, 2015, 2025, "My family's residential plot in District 2, HCMC. Neighbor has rebuilt their fence over the years, seemingly pushing eastwards into my property boundary."],
      value: 5n * 10n**18n
    });
    console.log(`Submitted claim 1. Tx Hash: ${tx1}`);
    console.log("Waiting for block confirmation...");
    await client.waitForTransactionReceipt({ hash: tx1 });
    console.log("Claim 1 finalized!");
  } catch (e) {
    console.error(`Failed to submit claim 1: ${e.message}`);
  }

  // Seed Hanoi (Clean)
  const hanoiPolygon = JSON.stringify([[21.0285, 105.8542], [21.0295, 105.8542], [21.0295, 105.8552], [21.0285, 105.8552]]);
  console.log("\n2. Submitting Hanoi Clean Claim (5 GEN)...");
  try {
    const tx2 = await client.writeContract({
      address: coreAddress,
      functionName: 'submit_claim',
      args: [hanoiPolygon, 2018, 2024, "A commercial plot located in Hoan Kiem District. Seeking official boundary verification before starting design phases for a commercial storefront."],
      value: 5n * 10n**18n
    });
    console.log(`Submitted claim 2. Tx Hash: ${tx2}`);
    console.log("Waiting for block confirmation...");
    await client.waitForTransactionReceipt({ hash: tx2 });
    console.log("Claim 2 finalized!");
  } catch (e) {
    console.error(`Failed to submit claim 2: ${e.message}`);
  }

  // Seed Dak Lak (Dispute Appeal)
  const daklakPolygon = JSON.stringify([[12.6712, 108.0382], [12.6722, 108.0382], [12.6722, 108.0392], [12.6712, 108.0392]]);
  console.log("\n3. Submitting Dak Lak Farm Claim (5 GEN)...");
  let claim3Id = 'claim_3';
  try {
    const tx3 = await client.writeContract({
      address: coreAddress,
      functionName: 'submit_claim',
      args: [daklakPolygon, 2016, 2025, "Agricultural coffee farm boundary. Suspect neighboring plantation has cleared trees and expanded road lanes inside our eastern boundary coordinates."],
      value: 5n * 10n**18n
    });
    console.log(`Submitted claim 3. Tx Hash: ${tx3}`);
    console.log("Waiting for block confirmation...");
    await client.waitForTransactionReceipt({ hash: tx3 });
    console.log("Claim 3 finalized!");

    // Get claim count to know the exact ID
    const count = await client.readContract({
      address: coreAddress,
      functionName: 'claim_count',
      args: []
    });
    claim3Id = `claim_${count}`;
    console.log(`Claim 3 registered with ID: ${claim3Id}`);
  } catch (e) {
    console.error(`Failed to submit claim 3: ${e.message}`);
  }

  // Run AI analysis on claim 1
  console.log("\n4. Running AI Consensus Analysis on Claim 1 (demo_hcmc)...");
  try {
    const txA1 = await client.writeContract({
      address: coreAddress,
      functionName: 'analyze_claim',
      args: ['claim_1']
    });
    console.log(`Triggered analysis 1. Tx Hash: ${txA1}`);
    await client.waitForTransactionReceipt({ hash: txA1 });
    console.log("Analysis 1 finalized!");
  } catch (e) {
    console.error(`Failed to analyze claim 1: ${e.message}`);
  }

  // Run AI analysis on claim 2
  console.log("\n5. Running AI Consensus Analysis on Claim 2 (demo_hanoi)...");
  try {
    const txA2 = await client.writeContract({
      address: coreAddress,
      functionName: 'analyze_claim',
      args: ['claim_2']
    });
    console.log(`Triggered analysis 2. Tx Hash: ${txA2}`);
    await client.waitForTransactionReceipt({ hash: txA2 });
    console.log("Analysis 2 finalized!");
  } catch (e) {
    console.error(`Failed to analyze claim 2: ${e.message}`);
  }

  // Run AI analysis on claim 3
  console.log("\n6. Running AI Consensus Analysis on Claim 3 (demo_daklak)...");
  try {
    const txA3 = await client.writeContract({
      address: coreAddress,
      functionName: 'analyze_claim',
      args: [claim3Id]
    });
    console.log(`Triggered analysis 3. Tx Hash: ${txA3}`);
    await client.waitForTransactionReceipt({ hash: txA3 });
    console.log("Analysis 3 finalized!");
  } catch (e) {
    console.error(`Failed to analyze claim 3: ${e.message}`);
  }

  // Submit dispute on claim 3
  console.log(`\n7. Submitting Dispute Appeal on ${claim3Id} (10 GEN)...`);
  try {
    const txDisp = await client.writeContract({
      address: coreAddress,
      functionName: 'dispute_claim',
      args: [claim3Id, "The initial analysis used low-res filters. The neighbor cleared tree canopy on the eastern buffer lane which is visible if using the red-edge band spectral analysis."],
      value: 10n * 10n**18n
    });
    console.log(`Submitted dispute. Tx Hash: ${txDisp}`);
    await client.waitForTransactionReceipt({ hash: txDisp });
    console.log("Dispute finalized!");
  } catch (e) {
    console.error(`Failed to dispute claim 3: ${e.message}`);
  }

  console.log("\nSeeding completed successfully!");
}

main().catch(console.error);
