// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Strings.sol";

// ============ Interfaces ============

struct MutationRecord {
    string mutationType;
    bytes32 seed;
    uint256 timestamp;
}

interface ISpatters {
    function tokens(uint256) external view returns (bytes32 mintSeed, uint256 mintTimestamp);
    function getTokenMutations(uint256) external view returns (MutationRecord[] memory);
    function getCustomPalette(uint256) external view returns (string[6] memory);
    function totalSupply() external view returns (uint256);
    function ownerOf(uint256) external view returns (address);
}

/**
 * @title SpattersGenerator
 * @notice On-chain data provider and HTML template storage for Spatters NFTs
 * @dev Stores:
 *      - HTML template with embedded pako.js and loader JavaScript (in SSTORE2)
 *      - SSTORE2 addresses for spatters.js chunks
 *      - Reference to Spatters NFT contract for token data
 * 
 * Architecture:
 * - API server fetches HTML template from chain
 * - API injects RPC URLs (only off-chain dependency)
 * - Browser executes template which loads all data from blockchain:
 *   - spatters.js from Sepolia (our SSTORE2 contracts)
 *   - p5.js from Ethereum Mainnet (Art Blocks DependencyRegistry)
 *   - Token data from Sepolia (Spatters contract)
 * - Fully on-chain except RPC URL configuration
 */
contract SpattersGenerator {
    using Strings for uint256;

    // ============ Storage ============

    /// @notice Address of the Spatters NFT contract
    address public immutable SPATTERS_CONTRACT;

    /// @notice Array of SSTORE2 storage addresses containing spatters.js chunks
    address[] public STORAGE_ADDRESSES;

    /// @notice Array of SSTORE2 addresses containing the HTML template chunks
    /// @dev Template may be split across multiple contracts if > 24KB
    address[] public HTML_TEMPLATE_ADDRESSES;

    // ============ Constructor ============

    /**
     * @notice Initialize the generator with contract references
     * @param _spattersContract Address of the Spatters NFT contract
     * @param _storageAddresses Array of SSTORE2 storage addresses for spatters.js
     * @param _htmlTemplateAddresses Array of SSTORE2 addresses containing HTML template chunks
     */
    constructor(
        address _spattersContract,
        address[] memory _storageAddresses,
        address[] memory _htmlTemplateAddresses
    ) {
        require(_spattersContract != address(0), "Invalid spatters contract");
        require(_storageAddresses.length > 0, "Must provide storage addresses");
        require(_htmlTemplateAddresses.length > 0, "Must provide template addresses");
        
        for (uint i = 0; i < _storageAddresses.length; i++) {
            require(_storageAddresses[i] != address(0), "Invalid storage address");
        }
        
        for (uint i = 0; i < _htmlTemplateAddresses.length; i++) {
            require(_htmlTemplateAddresses[i] != address(0), "Invalid template address");
        }

        SPATTERS_CONTRACT = _spattersContract;
        STORAGE_ADDRESSES = _storageAddresses;
        HTML_TEMPLATE_ADDRESSES = _htmlTemplateAddresses;
    }

    // ============ Public View Functions ============

    /**
     * @notice Get all SSTORE2 storage addresses for spatters.js chunks
     * @dev Client reads each chunk separately, avoiding RPC gas limits
     * @return Array of storage contract addresses
     */
    function getStorageAddresses() external view returns (address[] memory) {
        return STORAGE_ADDRESSES;
    }

    /**
     * @notice Get the number of storage chunks for spatters.js
     * @return Number of SSTORE2 storage contracts
     */
    function getStorageCount() external view returns (uint256) {
        return STORAGE_ADDRESSES.length;
    }

    /**
     * @notice Get a single storage address by index
     * @param index The chunk index
     * @return The storage contract address
     */
    function getStorageAddress(uint256 index) external view returns (address) {
        require(index < STORAGE_ADDRESSES.length, "Index out of bounds");
        return STORAGE_ADDRESSES[index];
    }

    /**
     * @notice Get all SSTORE2 addresses for HTML template chunks
     * @return Array of template chunk addresses
     */
    function getHtmlTemplateAddresses() external view returns (address[] memory) {
        return HTML_TEMPLATE_ADDRESSES;
    }

    /**
     * @notice Get the number of HTML template chunks
     * @return Number of template SSTORE2 contracts
     */
    function getHtmlTemplateCount() external view returns (uint256) {
        return HTML_TEMPLATE_ADDRESSES.length;
    }

    /**
     * @notice Get complete token data for client-side HTML assembly
     * @param tokenId The token ID
     * @return seed The mint seed (bytes32)
     * @return mutationSeeds Array of mutation seeds
     * @return mutationTypes Array of mutation type strings
     * @return customPalette Array of 6 color strings (empty if no custom palette)
     */
    function getTokenData(uint256 tokenId) external view returns (
        bytes32 seed,
        bytes32[] memory mutationSeeds,
        string[] memory mutationTypes,
        string[6] memory customPalette
    ) {
        ISpatters spatters = ISpatters(SPATTERS_CONTRACT);
        
        // Verify token exists
        require(spatters.ownerOf(tokenId) != address(0), "Token does not exist");

        // Get mint seed
        (seed, ) = spatters.tokens(tokenId);
        
        // Get mutations
        MutationRecord[] memory mutations = spatters.getTokenMutations(tokenId);
        
        mutationSeeds = new bytes32[](mutations.length);
        mutationTypes = new string[](mutations.length);
        
        for (uint i = 0; i < mutations.length; i++) {
            mutationSeeds[i] = mutations[i].seed;
            mutationTypes[i] = mutations[i].mutationType;
        }
        
        // Get custom palette
        customPalette = spatters.getCustomPalette(tokenId);
    }

    /**
     * @notice Read raw bytes from a single SSTORE2 storage contract
     * @dev Useful for client to read chunks individually
     * @param storageAddress The SSTORE2 storage contract address
     * @return The raw bytes stored (excluding STOP opcode)
     */
    function readStorageChunk(address storageAddress) external view returns (bytes memory) {
        bytes memory chunk;
        assembly {
            let size := extcodesize(storageAddress)
            chunk := mload(0x40)
            mstore(0x40, add(chunk, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            mstore(chunk, sub(size, 1))
            extcodecopy(storageAddress, add(chunk, 0x20), 1, sub(size, 1))
        }
        return chunk;
    }

    /**
     * @notice Get the complete HTML template (concatenated from all chunks)
     * @dev The template contains placeholders that the API replaces:
     *      - {{SEPOLIA_RPC}} - Sepolia RPC URL
     *      - {{MAINNET_RPC}} - Mainnet RPC URL (for Art Blocks p5.js)
     *      - {{TOKEN_ID}} - The token ID
     *      - {{GENERATOR_CONTRACT}} - This contract's address
     *      - {{SPATTERS_CONTRACT}} - Spatters NFT contract address
     *      - {{STORAGE_ADDRESSES}} - JSON array of SSTORE2 addresses
     * @return The complete HTML template as a string
     */
    function getHtmlTemplate() external view returns (string memory) {
        // If only one chunk, return directly
        if (HTML_TEMPLATE_ADDRESSES.length == 1) {
            return string(_readFromSSTORE2(HTML_TEMPLATE_ADDRESSES[0]));
        }
        
        // Multiple chunks - need to concatenate
        bytes memory result;
        uint256 totalLength = 0;
        
        // First pass: calculate total length
        for (uint i = 0; i < HTML_TEMPLATE_ADDRESSES.length; i++) {
            bytes memory chunk = _readFromSSTORE2(HTML_TEMPLATE_ADDRESSES[i]);
            totalLength += chunk.length;
        }
        
        // Allocate result
        result = new bytes(totalLength);
        uint256 offset = 0;
        
        // Second pass: copy data
        for (uint i = 0; i < HTML_TEMPLATE_ADDRESSES.length; i++) {
            bytes memory chunk = _readFromSSTORE2(HTML_TEMPLATE_ADDRESSES[i]);
            for (uint j = 0; j < chunk.length; j++) {
                result[offset + j] = chunk[j];
            }
            offset += chunk.length;
        }
        
        return string(result);
    }

    /**
     * @notice Get all configuration needed for the HTML template
     * @dev API uses this to get all addresses for template injection
     * @return spattersContract The Spatters NFT contract address
     * @return generatorContract This contract's address
     * @return storageAddresses Array of SSTORE2 addresses for spatters.js
     * @return templateAddresses Array of SSTORE2 addresses for HTML template
     */
    function getTemplateConfig() external view returns (
        address spattersContract,
        address generatorContract,
        address[] memory storageAddresses,
        address[] memory templateAddresses
    ) {
        return (
            SPATTERS_CONTRACT,
            address(this),
            STORAGE_ADDRESSES,
            HTML_TEMPLATE_ADDRESSES
        );
    }

    /**
     * @notice Internal function to read data from SSTORE2 contract
     * @param storageAddress The SSTORE2 contract address
     * @return The stored bytes (excluding the STOP opcode prefix)
     */
    function _readFromSSTORE2(address storageAddress) internal view returns (bytes memory) {
        bytes memory data;
        assembly {
            let size := extcodesize(storageAddress)
            // Subtract 1 to exclude the STOP opcode prefix
            let dataSize := sub(size, 1)
            data := mload(0x40)
            // Round up to nearest 32 bytes for proper memory allocation
            mstore(0x40, add(data, and(add(add(dataSize, 0x20), 0x1f), not(0x1f))))
            mstore(data, dataSize)
            // Copy from offset 1 to skip the STOP opcode
            extcodecopy(storageAddress, add(data, 0x20), 1, dataSize)
        }
        return data;
    }
}
