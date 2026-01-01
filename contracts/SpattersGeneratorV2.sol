// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

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
 * @title SpattersGeneratorV2
 * @notice On-chain data provider, HTML template storage, and legal terms for Spatters NFTs
 * @dev Stores:
 *      - HTML template with loader JavaScript (in SSTORE2)
 *      - SSTORE2 addresses for spatters.js chunks
 *      - Reference to Spatters NFT contract for token data
 *      - On-chain legal representations
 *      - Updatable Terms of Service URL
 * 
 * Architecture:
 * - API server fetches HTML template from chain
 * - API injects RPC URLs (only off-chain dependency)
 * - Browser executes template which loads all data from blockchain:
 *   - spatters.js from our SSTORE2 contracts
 *   - p5.js from Artblocks DependencyRegistry
 *   - Token data from Spatters contract
 * - Fully on-chain except RPC URL configuration
 * 
 * Legal:
 * - On-chain LEGAL_NOTICE provides immutable legal representations
 * - termsOfServiceURL points to full terms (updatable by owner)
 * - Interaction with this contract or Spatters contract constitutes agreement
 */
contract SpattersGeneratorV2 {
    using Strings for uint256;

    // ============ Legal Notice ============

    /// @notice On-chain legal representations - interaction constitutes agreement
    /// @dev This notice applies to interactions with both this contract AND the 
    ///      Spatters NFT contract which references this generator
    string public constant LEGAL_NOTICE = 
        "BY INTERACTING WITH THIS CONTRACT OR THE SPATTERS CONTRACT (which references "
        "this generator and is referenced by this generator), YOU REPRESENT AND AGREE: "
        "(1) All minting fees paid to the Spatters contract are NON-REFUNDABLE under "
        "any circumstances, including failure to complete the minting process within "
        "the required time window; (2) You are NOT acquiring any NFT for investment "
        "purposes and have NO expectation of profit or financial return; (3) You "
        "understand the NFT may have ZERO monetary value and you accept this risk; "
        "(4) The smart contracts have NOT been audited by any third party; (5) You "
        "are at least 18 years old and not located in a sanctioned jurisdiction; "
        "(6) You have read the full Terms of Service at the URL returned by "
        "getTermsOfServiceURL().";

    // ============ Storage ============

    /// @notice Address of the Spatters NFT contract
    address public immutable SPATTERS_CONTRACT;

    /// @notice Array of SSTORE2 storage addresses containing spatters.js chunks
    address[] public STORAGE_ADDRESSES;

    /// @notice Array of SSTORE2 addresses containing the HTML template chunks
    /// @dev Template may be split across multiple contracts if > 24KB
    address[] public HTML_TEMPLATE_ADDRESSES;

    /// @notice Contract owner (for terms URL updates only)
    address public owner;

    /// @notice URL to full Terms of Service (updatable by owner)
    string public termsOfServiceURL;

    // ============ Events ============

    /// @notice Emitted when the Terms of Service URL is updated
    event TermsOfServiceURLUpdated(string oldURL, string newURL);

    /// @notice Emitted when ownership is transferred
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============ Constructor ============

    /**
     * @notice Initialize the generator with contract references and initial terms URL
     * @param _spattersContract Address of the Spatters NFT contract
     * @param _storageAddresses Array of SSTORE2 storage addresses for spatters.js
     * @param _htmlTemplateAddresses Array of SSTORE2 addresses containing HTML template chunks
     * @param _initialTermsURL Initial URL to the Terms of Service
     */
    constructor(
        address _spattersContract,
        address[] memory _storageAddresses,
        address[] memory _htmlTemplateAddresses,
        string memory _initialTermsURL
    ) {
        require(_spattersContract != address(0), "Invalid spatters contract");
        require(_storageAddresses.length > 0, "Must provide storage addresses");
        require(_htmlTemplateAddresses.length > 0, "Must provide template addresses");
        require(bytes(_initialTermsURL).length > 0, "Must provide terms URL");
        
        for (uint i = 0; i < _storageAddresses.length; i++) {
            require(_storageAddresses[i] != address(0), "Invalid storage address");
        }
        
        for (uint i = 0; i < _htmlTemplateAddresses.length; i++) {
            require(_htmlTemplateAddresses[i] != address(0), "Invalid template address");
        }

        SPATTERS_CONTRACT = _spattersContract;
        STORAGE_ADDRESSES = _storageAddresses;
        HTML_TEMPLATE_ADDRESSES = _htmlTemplateAddresses;
        termsOfServiceURL = _initialTermsURL;
        owner = msg.sender;
    }

    // ============ Owner Functions ============

    /**
     * @notice Update the Terms of Service URL
     * @dev Only callable by owner. Use this if the terms URL changes.
     * @param _newURL The new Terms of Service URL
     */
    function setTermsOfServiceURL(string calldata _newURL) external {
        require(msg.sender == owner, "Only owner can update terms URL");
        require(bytes(_newURL).length > 0, "URL cannot be empty");
        
        string memory oldURL = termsOfServiceURL;
        termsOfServiceURL = _newURL;
        
        emit TermsOfServiceURLUpdated(oldURL, _newURL);
    }

    /**
     * @notice Transfer ownership to a new address
     * @dev Only callable by current owner
     * @param _newOwner The new owner address
     */
    function transferOwnership(address _newOwner) external {
        require(msg.sender == owner, "Only owner can transfer ownership");
        require(_newOwner != address(0), "New owner cannot be zero address");
        
        address oldOwner = owner;
        owner = _newOwner;
        
        emit OwnershipTransferred(oldOwner, _newOwner);
    }

    // ============ Legal View Functions ============

    /**
     * @notice Returns the on-chain legal notice
     * @dev This notice is immutable and stored as a constant
     * @return The full legal notice text
     */
    function getLegalNotice() external pure returns (string memory) {
        return LEGAL_NOTICE;
    }

    /**
     * @notice Returns the URL to the full Terms of Service
     * @dev This URL can be updated by the owner if needed
     * @return The Terms of Service URL
     */
    function getTermsOfServiceURL() external view returns (string memory) {
        return termsOfServiceURL;
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
        return _readFromSSTORE2(storageAddress);
    }

    /**
     * @notice Get the complete HTML template (concatenated from all chunks)
     * @dev The template contains placeholders that the API replaces:
     *      - {{CONTRACT_RPC}} - RPC URL for Spatters contract chain
     *      - {{ARTBLOCKS_RPC}} - Mainnet RPC URL (Art Blocks p5.js is always on Mainnet)
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

