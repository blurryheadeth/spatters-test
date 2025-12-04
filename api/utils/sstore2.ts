/**
 * SSTORE2 Chunk Reading Utilities
 * 
 * Reads data from SSTORE2 storage contracts.
 * SSTORE2 stores data as contract bytecode with a leading STOP (0x00) opcode.
 * When reading, we skip the first byte.
 */

import { PublicClient, Address, Hex, hexToString } from "viem";

// ABI for reading raw bytecode from SSTORE2 contracts
// We use eth_getCode directly since SSTORE2 doesn't have a read() function
export const SSTORE2_ABI = [] as const;

/**
 * Read data from a single SSTORE2 storage contract
 * @param client - viem public client
 * @param storageAddress - Address of the SSTORE2 storage contract
 * @returns The stored data as a string (excluding STOP opcode prefix)
 */
export async function readSstore2Chunk(
  client: PublicClient,
  storageAddress: Address
): Promise<string> {
  // Get the bytecode of the storage contract
  const bytecode = await client.getBytecode({ address: storageAddress });
  
  if (!bytecode || bytecode.length < 4) {
    throw new Error(`No data found at storage address ${storageAddress}`);
  }
  
  // SSTORE2 format: 0x00 (STOP opcode) + data
  // Skip the first byte (0x00) which is "0x00" -> slice from position 4
  // The hex string is "0x" + "00" + data, so we slice starting at index 4
  const dataHex = ("0x" + bytecode.slice(4)) as Hex;
  
  // Convert hex to string
  return hexToString(dataHex);
}

/**
 * Read all SSTORE2 chunks in parallel and concatenate
 * @param client - viem public client
 * @param storageAddresses - Array of SSTORE2 storage contract addresses
 * @returns The complete concatenated data as a string
 */
export async function readAllSstore2Chunks(
  client: PublicClient,
  storageAddresses: Address[]
): Promise<string> {
  console.log(`📦 Reading ${storageAddresses.length} SSTORE2 chunks in parallel...`);
  
  // Read all chunks in parallel - each is a small ~24KB read
  const chunkPromises = storageAddresses.map((addr, index) => 
    readSstore2Chunk(client, addr).then(data => {
      console.log(`   ✓ Chunk ${index + 1}/${storageAddresses.length}: ${data.length} chars`);
      return { index, data };
    })
  );
  
  const results = await Promise.all(chunkPromises);
  
  // Sort by index (parallel execution may complete out of order)
  results.sort((a, b) => a.index - b.index);
  
  // Concatenate in order
  const fullScript = results.map(r => r.data).join("");
  
  console.log(`📦 Total script size: ${fullScript.length} chars`);
  
  return fullScript;
}

/**
 * Batch read storage addresses from generator contract
 * Uses a single small RPC call to get all addresses
 */
export async function getStorageAddresses(
  client: PublicClient,
  generatorAddress: Address
): Promise<Address[]> {
  const result = await client.readContract({
    address: generatorAddress,
    abi: [
      {
        name: "getStorageAddresses",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address[]" }],
      },
    ],
    functionName: "getStorageAddresses",
  });
  
  return result as Address[];
}



