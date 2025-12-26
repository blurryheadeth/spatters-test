// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "./ExponentialPricing.sol";
import "./DateTime.sol";

/**
 * @title Spatters
 * @dev Fully on-chain seed-based generative NFT collection
 * Only seeds and mutation records stored on-chain
 * Images generated client-side using on-chain p5.js code
 * Only external dependency is an RPC client 
 *
 * Features:
 * - Two-step minting with 3-choice preview selection
 * - Owner-only custom palette support
 * - Date-based mutation system with 94 mutation types
 * - EIP-2981 royalty standard (5% secondary sales)
 * - All code stored on-chain, zero external dependencies
 */
contract Spatters is ERC721Enumerable, Ownable, ReentrancyGuardTransient, IERC2981 {
    using Strings for uint256;

    // ============ Constants ============

    uint256 public constant MAX_SUPPLY = 999;
    uint256 public constant OWNER_RESERVE = 30;
    
    // Minting cooldowns and limits
    uint256 public constant REQUEST_EXPIRATION = 55 minutes;
    uint256 public constant GLOBAL_COOLDOWN = 24 hours;  // 24h cooldown for public mint after ANY mint
    
    // Note: Default palette is hard-coded in spatters.js (deployed to SSTORE2):
    // ["#fc1a4a", "#75d494", "#2587c3", "#f2c945", "#000000", "#FFFFFF"]
    
    // ============ EIP-2981 Royalties ============
    
    /// @notice Royalty percentage in basis points (500 = 5%)
    uint96 public constant ROYALTY_BPS = 500;
    
    /// @notice Address that receives royalty payments
    address public royaltyReceiver;
    
    // ============ Community Governance (Available After 10 Years) ============
    
    /// @notice Deployment timestamp for governance delay calculation
    uint256 public immutable deploymentTime;
    
    /// @notice Governance becomes available 10 years after deployment
    /// @dev TESTING ONLY: Set to 0 for Sepolia testing. Change back to 10 * 365 days for mainnet!
    uint256 public constant GOVERNANCE_DELAY = 3 days; // MAINNET: 10 * 365 days
    
    /// @notice Cooldown between proposals (prevents spam)
    uint256 public constant PROPOSAL_COOLDOWN = 30 days;
    
    /// @notice Window to confirm proposal after threshold reached
    uint256 public constant CONFIRMATION_WINDOW = 48 hours;
    
    /// @notice Maximum time a proposal can remain open for voting (prevents "locked forever" bug)
    uint256 public constant VOTING_PERIOD = 25 days;
    
    /// @notice Timestamp of last proposal creation
    uint256 public lastProposalTime;
    
    /// @notice Generation counter for O(1) vote clearing
    /// @dev Incrementing this invalidates all previous votes without looping
    uint256 public proposalGeneration;
    
    /// @notice baseURI for tokenURI (can be updated by owner or community governance)
    string public baseURI;
    
    /// @notice Reference to the Generator contract (informational - for discoverability)
    /// @dev The Generator stores spatters.js and HTML template in SSTORE2
    /// This value is not used by this contract but provides an on-chain link
    /// for anyone reconstructing the rendering infrastructure
    address public generatorContract;
    
    /// @notice Whether the generator contract reference is permanently locked
    /// @dev Once locked, the generatorContract address can never be changed
    bool public generatorLocked;
    
    /// @notice Emitted when the generator contract reference is updated
    event GeneratorContractUpdated(address indexed oldGenerator, address indexed newGenerator);
    
    /// @notice Emitted when the generator contract reference is permanently locked
    event GeneratorPermanentlyLocked(address indexed lockedGenerator);
    
    struct CommunityProposal {
        address proposer;                // Address that created the proposal
        string proposedBaseURI;          // The proposed new baseURI
        uint256 proposalTime;            // When proposal was created
        uint256 totalVotesWeight;        // Total token weight of votes
        bool locked;                     // True after first vote (prevents frontrunning)
        bool thresholdReached;           // True when 67% approval reached
        uint256 thresholdReachedTime;    // When 67% was reached (starts 48h window)
        bool executed;                   // True after proposal confirmed and executed
        uint256 proposerTokenId;         // Token ID used to make this proposal (for banning)
    }
    
    /// @notice Current active proposal
    CommunityProposal public currentProposal;
    
    /// @notice Tracks which token IDs voted in which proposal generation
    /// @dev tokenId => generation when voted (if generation matches current, token has voted)
    mapping(uint256 => uint256) public tokenVoteGeneration;
    
    /// @notice Current ban generation (incremented when bans are cleared)
    /// @dev Starts at 1 so default mapping value (0) means "not banned"
    uint256 public banGeneration;
    
    /// @notice Tracks which token IDs are banned from proposing
    /// @dev tokenId => generation when banned (if matches banGeneration, token is banned)
    mapping(uint256 => uint256) public tokenBanGeneration;
    
    // ============ Structs ============

    struct TokenData {
        bytes32 mintSeed;              // Seed used to generate initial artwork
        uint256 mintTimestamp;         // When token was minted
    }
    
    struct MutationRecord {
        string mutationType;           // Name of mutation applied
        bytes32 seed;                  // Seed used for this mutation
        uint256 timestamp;             // When mutation occurred
    }
    
    struct MintRequest {
        bytes32[3] seeds;              // 3 seeds for user to preview
        uint256 timestamp;             // When request was made
        bool completed;                // Whether mint was completed
        address recipient;             // Who receives the minted token
        bool isOwnerMint;              // Whether this is an owner-initiated mint
        bool hasCustomPalette;         // Whether a custom palette was stored
    }

    // ============ State Variables ============

    mapping(uint256 => TokenData) public tokens;
    mapping(uint256 => MutationRecord[]) public tokenMutations;
    mapping(uint256 => string[6]) public customPalettes;  // Only populated for tokens with custom palettes
    MintRequest public pendingRequest;  // Single pending request (only one mint active at a time)
    string[6] public pendingPalette;  // Single pending palette (only one mint active at a time, only owner can use)
    
    uint256 private _nextTokenId = 1;
    uint256 public lastGlobalMintTime;
    
    // Global pending request tracking - blocks ALL minting during selection period
    address public activeMintRequester;    // Address with active 3-option selection
    uint256 public activeMintRequestTime;  // When the active request was made
    
    
    // Allowed mutation types (94 total from spatters.js)
    string[] public allowedMutations;
    
    // O(1) lookup for mutation type validation
    mapping(bytes32 => bool) private _mutationTypeHashes;
    
    
    // Per-token mutation cooldown tracking (UTC day number)
    mapping(uint256 => uint256) public lastMutationDay;
    
    // Milestone token IDs for anniversary-based mutations
    uint256 public constant MILESTONE_100 = 100;
    uint256 public constant MILESTONE_500 = 500;
    uint256 public constant MILESTONE_750 = 750;
    uint256 public constant MILESTONE_999 = 999;

    // ============ Events ============

    event MintRequested(
        address indexed requester,
        bytes32[3] seeds,
        uint256 timestamp,
        bool isOwnerMint
    );
    
    
    event Minted(
        uint256 indexed tokenId,
        address indexed minter,
        bytes32 seed,
        bool hasCustomPalette,
        uint256 timestamp
    );
    
    event Mutated(
        uint256 indexed tokenId,
        uint256 indexed mutationIndex,
        string mutationType,
        bytes32 seed,
        uint256 timestamp
    );
    
    event RoyaltyReceiverUpdated(address indexed newReceiver);
    
    // Governance events
    event ProposalCreated(address indexed proposer, string proposedURI, uint256 timestamp, uint256 proposerTokenId);
    event ProposalLocked(string lockedURI);
    event VoteCast(address indexed voter, uint256 tokenCount);
    event ProposalThresholdReached(string proposedURI, uint256 timestamp);
    event BaseURIUpdatedByCommunity(string newURI);
    event BaseURIUpdatedByOwner(string newURI);
    event TokenBannedFromProposing(uint256 indexed tokenId);
    event AllProposalBansCleared(uint256 newBanGeneration);
    event ProposalExpired(string proposedURI, uint256 proposerTokenId);

    // ============ Constructor ============

    /**
     * @dev Constructor initializes the Spatters NFT collection
     * Script storage addresses are managed by the separate SpattersGenerator contract
     */
    constructor() ERC721("Spatters", "SPAT") Ownable(msg.sender) {
        // Set initial royalty receiver to contract owner
        royaltyReceiver = msg.sender;
        
        // Record deployment time for governance delay
        deploymentTime = block.timestamp;
        
        // Initialize governance generations to 1 (so default 0 means "hasn't voted" / "not banned")
        banGeneration = 1;
        proposalGeneration = 1;
        
        _initializeMutationTypes();
    }

    // ============ Initialization ============

    /**
     * @dev Initialize the 94 allowed mutation types from spatters.js
     * Also populates _mutationTypeHashes for O(1) validation
     */
    function _initializeMutationTypes() private {
        // Helper to add mutation to both array and hash mapping
        _addMutation("aspectRatioChange");
        _addMutation("baseRadiusIncrease");
        _addMutation("baseRadiusDecrease");
        _addMutation("gradientTypeChange");
        _addMutation("dividerCountChange");
        _addMutation("circleCountChange");
        _addMutation("lineCountChange");
        _addMutation("circleSizeIncrease");
        _addMutation("circleSizeDecrease");
        _addMutation("circlePositionChange");
        
        // Circle mutations
        _addMutation("circleMoveLeft");
        _addMutation("circleMoveRight");
        _addMutation("circleMoveUp");
        _addMutation("circleMoveDown");
        
        // Line mutations
        _addMutation("lineWidthIncrease");
        _addMutation("lineWidthDecrease");
        _addMutation("lineAngleChange");
        _addMutation("lineLengthIncrease");
        _addMutation("lineLengthDecrease");
        _addMutation("linePositionChange");
        _addMutation("lineMoveLeft");
        _addMutation("lineMoveRight");
        _addMutation("lineMoveUp");
        _addMutation("lineMoveDown");
        
        // Palette mutations
        _addMutation("paletteChangeOne");
        _addMutation("paletteChangeAll");
        _addMutation("paletteCombineOne");
        _addMutation("paletteCombineAll");
        _addMutation("paletteResetOne");
        _addMutation("paletteResetAll");
        _addMutation("paletteShuffle");
        
        // Divider and rotation
        _addMutation("dividerMove");
        _addMutation("dividerRotate");
        _addMutation("rotate");
        
        // Seedpoint count
        _addMutation("seedPointCountIncrease");
        _addMutation("seedPointCountDecrease");
        
        // Generic seedpoint mutations
        _addMutation("seedpointMoveRight");
        _addMutation("seedpointMoveLeft");
        _addMutation("seedpointMoveUp");
        _addMutation("seedpointMoveDown");
        _addMutation("seedpointChangeCurveCenter");
        _addMutation("seedpointIncreaseConcavity");
        _addMutation("seedpointDecreaseConcavity");
        _addMutation("seedpointIncreaseRadius");
        _addMutation("seedpointDecreaseRadius");
        
        // Shape mutations
        _addMutation("shapeExpand");
        _addMutation("shapeShrink");
        _addMutation("shapeMakeWider");
        _addMutation("shapeMakeNarrower");
        _addMutation("shapeMakeHigher");
        _addMutation("shapeMakeShorter");
        _addMutation("shapeChangeCurveCenters");
        _addMutation("shapeIncreaseConcavity");
        _addMutation("shapeReduceConcavity");
        _addMutation("shapeChangeRadiuses");
        _addMutation("shapeMove");
        
        // Undo mutations
        _addMutation("undoMutation");
        _addMutation("returnToPreviousVersion");
        
        // Seedpoint-top mutations
        _addMutation("seedpointMoveRight-top");
        _addMutation("seedpointMoveLeft-top");
        _addMutation("seedpointMoveUp-top");
        _addMutation("seedpointMoveDown-top");
        _addMutation("seedpointChangeCurveCenter-top");
        _addMutation("seedpointIncreaseConcavity-top");
        _addMutation("seedpointDecreaseConcavity-top");
        _addMutation("seedpointIncreaseRadius-top");
        _addMutation("seedpointDecreaseRadius-top");
        
        // Seedpoint-bottom mutations
        _addMutation("seedpointMoveRight-bottom");
        _addMutation("seedpointMoveLeft-bottom");
        _addMutation("seedpointMoveUp-bottom");
        _addMutation("seedpointMoveDown-bottom");
        _addMutation("seedpointChangeCurveCenter-bottom");
        _addMutation("seedpointIncreaseConcavity-bottom");
        _addMutation("seedpointDecreaseConcavity-bottom");
        _addMutation("seedpointIncreaseRadius-bottom");
        _addMutation("seedpointDecreaseRadius-bottom");
        
        // Seedpoint-left mutations
        _addMutation("seedpointMoveRight-left");
        _addMutation("seedpointMoveLeft-left");
        _addMutation("seedpointMoveUp-left");
        _addMutation("seedpointMoveDown-left");
        _addMutation("seedpointChangeCurveCenter-left");
        _addMutation("seedpointIncreaseConcavity-left");
        _addMutation("seedpointDecreaseConcavity-left");
        _addMutation("seedpointIncreaseRadius-left");
        _addMutation("seedpointDecreaseRadius-left");
        
        // Seedpoint-right mutations
        _addMutation("seedpointMoveRight-right");
        _addMutation("seedpointMoveLeft-right");
        _addMutation("seedpointMoveUp-right");
        _addMutation("seedpointMoveDown-right");
        _addMutation("seedpointChangeCurveCenter-right");
        _addMutation("seedpointIncreaseConcavity-right");
        _addMutation("seedpointDecreaseConcavity-right");
        _addMutation("seedpointIncreaseRadius-right");
        _addMutation("seedpointDecreaseRadius-right");
    }
    
    /**
     * @dev Helper to add mutation to both array and hash mapping
     */
    function _addMutation(string memory mutationType) private {
        allowedMutations.push(mutationType);
        _mutationTypeHashes[keccak256(bytes(mutationType))] = true;
    }

    // ============ Public Minting Functions ============

    /**
     * @dev Step 1: Request mint - Generates 3 seeds for preview
     * Users pay mint price and get 3 seeds to preview before choosing
     */
    function requestMint() external payable nonReentrant returns (bytes32[3] memory) {
        require(_nextTokenId > OWNER_RESERVE, "Owner mint period active");
        require(_nextTokenId <= MAX_SUPPLY, "Max supply reached");
        
        // Check if ANY mint selection is in progress (blocks all minting)
        require(
            activeMintRequester == address(0) ||
            block.timestamp > activeMintRequestTime + REQUEST_EXPIRATION,
            "Mint selection in progress"
        );
        
        require(
            block.timestamp >= lastGlobalMintTime + GLOBAL_COOLDOWN,
            "Global cooldown active"
        );
        
        // Check payment
        uint256 price = ExponentialPricing.calculatePrice(_nextTokenId, OWNER_RESERVE);
        require(msg.value >= price, "Insufficient payment");
        
        // Check for existing pending request
        // Allow new request only if previous request is completed OR expired
        require(
            pendingRequest.completed ||
            block.timestamp > pendingRequest.timestamp + REQUEST_EXPIRATION,
            "Pending request exists"
        );
        
        // Generate 3 unique seeds
        bytes32[3] memory seeds;
        for (uint8 i = 0; i < 3; i++) {
            seeds[i] = _generateSeed(msg.sender, block.timestamp, i);
        }
        
        // Store request
        pendingRequest = MintRequest({
            seeds: seeds,
            timestamp: block.timestamp,
            completed: false,
            recipient: msg.sender,
            isOwnerMint: false,
            hasCustomPalette: false
        });
        
        // Set global active request (blocks all other minting)
        activeMintRequester = msg.sender;
        activeMintRequestTime = block.timestamp;
        
        emit MintRequested(msg.sender, seeds, block.timestamp, false);
        
        return seeds;
    }

    /**
     * @dev Step 2: Complete mint - User chooses from 3 previews
     * @param seedChoice Index of chosen seed (0, 1, or 2)
     */
    function completeMint(uint8 seedChoice) external nonReentrant {
        require(seedChoice < 3, "Invalid seed choice");
        
        // Verify this user is the active requester
        require(activeMintRequester == msg.sender, "Not your pending request");
        
        require(pendingRequest.timestamp > 0, "No pending request");
        require(!pendingRequest.completed, "Request already completed");
        require(!pendingRequest.isOwnerMint, "Use completeOwnerMint for owner mints");
        require(
            block.timestamp <= pendingRequest.timestamp + REQUEST_EXPIRATION,
            "Request expired"
        );
        
        // Get chosen seed
        bytes32 chosenSeed = pendingRequest.seeds[seedChoice];
        
        // Mark request as completed and clear global active request
        pendingRequest.completed = true;
        activeMintRequester = address(0);
        activeMintRequestTime = 0;
        
        // Update tracking
        lastGlobalMintTime = block.timestamp;
        
        // Store token data
        uint256 tokenId = _nextTokenId++;
        tokens[tokenId] = TokenData({
            mintSeed: chosenSeed,
            mintTimestamp: block.timestamp
        });
        // No custom palette for public mints - customPalettes[tokenId] remains unset
        
        // Mint token
        _safeMint(msg.sender, tokenId);
        
        emit Minted(tokenId, msg.sender, chosenSeed, false, block.timestamp);
    }

    // ============ Owner Minting Functions ============

    /**
     * @dev Step 1 for owner: Request 3 seeds to preview (no custom seed provided)
     * @param customPalette Array of 6 hex colors (empty strings for default)
     * 
     * This generates 3 seeds BY THE CONTRACT for the owner to preview.
     * Use ownerMint() with a customSeed if you want to skip the 3-option flow.
     */
    function requestOwnerMint(
        string[6] calldata customPalette
    ) external onlyOwner nonReentrant returns (bytes32[3] memory) {
        require(_nextTokenId <= MAX_SUPPLY, "Max supply reached");
        
        // Check if ANY mint selection is in progress (blocks all minting)
        require(
            activeMintRequester == address(0) ||
            block.timestamp > activeMintRequestTime + REQUEST_EXPIRATION,
            "Mint selection in progress"
        );
        
        // Validate custom palette if provided
        bool hasCustomPalette = bytes(customPalette[0]).length > 0;
        if (hasCustomPalette) {
            for (uint i = 0; i < 6; i++) {
                require(_isValidHexColor(customPalette[i]), "Invalid hex color");
            }
        }
        
        // Generate 3 unique seeds BY THE CONTRACT
        bytes32[3] memory seeds;
        for (uint8 i = 0; i < 3; i++) {
            seeds[i] = _generateSeed(msg.sender, block.timestamp, i);
        }
        
        // Store request with recipient
        pendingRequest = MintRequest({
            seeds: seeds,
            timestamp: block.timestamp,
            completed: false,
            recipient: msg.sender,
            isOwnerMint: true,
            hasCustomPalette: hasCustomPalette
        });
        
        // Store palette separately if provided
        if (hasCustomPalette) {
            for (uint i = 0; i < 6; i++) {
                pendingPalette[i] = customPalette[i];
            }
        }
        
        // Set global active request (blocks all other minting)
        activeMintRequester = msg.sender;
        activeMintRequestTime = block.timestamp;
        
        emit MintRequested(msg.sender, seeds, block.timestamp, true);
        
        return seeds;
    }

    /**
     * @dev Step 2 for owner: Complete mint by choosing from 3 previews
     * @param seedChoice Index of chosen seed (0, 1, or 2)
     */
    function completeOwnerMint(uint8 seedChoice) external onlyOwner nonReentrant {
        require(seedChoice < 3, "Invalid seed choice");
        
        // Verify this is the active request
        require(activeMintRequester == msg.sender, "Not your pending request");
        
        require(pendingRequest.timestamp > 0, "No pending request");
        require(!pendingRequest.completed, "Request already completed");
        require(pendingRequest.isOwnerMint, "Not an owner mint request");
        require(
            block.timestamp <= pendingRequest.timestamp + REQUEST_EXPIRATION,
            "Request expired"
        );
        
        // Get chosen seed and recipient
        bytes32 chosenSeed = pendingRequest.seeds[seedChoice];
        address recipient = pendingRequest.recipient;
        bool hasCustomPalette = pendingRequest.hasCustomPalette;
        
        // Mark request as completed and clear global active request
        pendingRequest.completed = true;
        activeMintRequester = address(0);
        activeMintRequestTime = 0;
        
        // Update global mint time (triggers 24h cooldown for public mints)
        lastGlobalMintTime = block.timestamp;
        
        // Store token data
        uint256 tokenId = _nextTokenId++;
        tokens[tokenId] = TokenData({
            mintSeed: chosenSeed,
            mintTimestamp: block.timestamp
        });
        
        // Copy custom palette from pending to token if provided
        if (hasCustomPalette) {
            for (uint i = 0; i < 6; i++) {
                customPalettes[tokenId][i] = pendingPalette[i];
            }
        }
        
        // Clear pending palette after use
        for (uint i = 0; i < 6; i++) {
            pendingPalette[i] = "";
        }
        
        // Mint token
        _safeMint(recipient, tokenId);
        
        emit Minted(tokenId, recipient, chosenSeed, hasCustomPalette, block.timestamp);
    }

    /**
     * @dev Direct owner mint with a pre-defined seed (bypasses 3-option flow)
     * @param customPalette Array of 6 hex colors (empty strings for default)
     * @param customSeed Required seed for deterministic minting (must be non-zero)
     * 
     * Use this when you have a specific seed you want to use.
     * For the 3-option preview flow, use requestOwnerMint() + completeOwnerMint().
     */
    function ownerMint(
        string[6] calldata customPalette,
        bytes32 customSeed
    ) external onlyOwner nonReentrant {
        require(_nextTokenId <= MAX_SUPPLY, "Max supply reached");
        require(customSeed != bytes32(0), "Custom seed required - use requestOwnerMint for 3-option flow");
        
        // Check if ANY mint selection is in progress (blocks all minting)
        require(
            activeMintRequester == address(0) ||
            block.timestamp > activeMintRequestTime + REQUEST_EXPIRATION,
            "Mint selection in progress"
        );
        
        // Validate custom palette if provided
        bool hasCustomPalette = bytes(customPalette[0]).length > 0;
        if (hasCustomPalette) {
            for (uint i = 0; i < 6; i++) {
                require(_isValidHexColor(customPalette[i]), "Invalid hex color");
            }
        }
        
        // Update global mint time (triggers 24h cooldown for public mints)
        lastGlobalMintTime = block.timestamp;
        
        // Store token data
        uint256 tokenId = _nextTokenId++;
        tokens[tokenId] = TokenData({
            mintSeed: customSeed,
            mintTimestamp: block.timestamp
        });
        
        // Store custom palette if provided
        if (hasCustomPalette) {
            for (uint i = 0; i < 6; i++) {
                customPalettes[tokenId][i] = customPalette[i];
            }
        }
        
        // Mint token
        _safeMint(msg.sender, tokenId);
        
        emit Minted(tokenId, msg.sender, customSeed, hasCustomPalette, block.timestamp);
    }

    // ============ Mutation Functions ============

    /**
     * @dev Mutate a token (only on eligible dates)
     * @param tokenId Token to mutate
     * @param mutationType Type of mutation to apply
     */
    function mutate(
        uint256 tokenId,
        string memory mutationType
    ) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(_isValidMutationType(mutationType), "Invalid mutation type");
        require(canMutate(tokenId), "Cannot mutate today");
        
        // Record the current UTC day to prevent multiple mutations
        lastMutationDay[tokenId] = block.timestamp / 1 days;
        
        // Generate deterministic seed for this mutation
        bytes32 mutationSeed = _generateMutationSeed(
            tokenId,
            tokenMutations[tokenId].length,
            mutationType
        );
        
        // Store mutation record
        tokenMutations[tokenId].push(MutationRecord({
            mutationType: mutationType,
            seed: mutationSeed,
            timestamp: block.timestamp
        }));
        
        emit Mutated(
            tokenId,
            tokenMutations[tokenId].length - 1,
            mutationType,
            mutationSeed,
            block.timestamp
        );
    }

    /**
     * @dev Owner bypass for mutation testing (Sepolia only - remove for mainnet)
     * Allows contract owner to mutate any token without date/cooldown restrictions
     * @param tokenId Token to mutate
     * @param mutationType Type of mutation to apply
     */
    function ownerMutate(
        uint256 tokenId,
        string memory mutationType
    ) external onlyOwner nonReentrant {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(_isValidMutationType(mutationType), "Invalid mutation type");
        
        // No date/cooldown checks - owner can mutate anytime for testing
        
        // Generate deterministic seed for this mutation
        bytes32 mutationSeed = _generateMutationSeed(
            tokenId,
            tokenMutations[tokenId].length,
            mutationType
        );
        
        // Store mutation record
        tokenMutations[tokenId].push(MutationRecord({
            mutationType: mutationType,
            seed: mutationSeed,
            timestamp: block.timestamp
        }));
        
        emit Mutated(
            tokenId,
            tokenMutations[tokenId].length - 1,
            mutationType,
            mutationSeed,
            block.timestamp
        );
    }

    /**
     * @dev Check if a token can be mutated today
     * @param tokenId Token to check
     * @return bool Whether token can be mutated
     */
    function canMutate(uint256 tokenId) public view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        TokenData memory token = tokens[tokenId];
        uint256 currentDay = block.timestamp / 1 days;
        uint256 mintDay = token.mintTimestamp / 1 days;
        
        // Cannot mutate on the same UTC day as minting
        if (currentDay == mintDay) {
            return false;
        }
        
        // Cannot mutate if already mutated today (one mutation per UTC day)
        if (lastMutationDay[tokenId] == currentDay) {
            return false;
        }
        
        // Check if today is an eligible mutation date (anniversary-based)
        return _isEligibleMutationDate(tokenId, block.timestamp);
    }
    
    /**
     * @dev Check if a timestamp falls on an eligible mutation anniversary
     * @param tokenId Token to check
     * @param timestamp Current timestamp
     * @return bool Whether the date is eligible
     */
    function _isEligibleMutationDate(uint256 tokenId, uint256 timestamp) internal view returns (bool) {
        TokenData memory token = tokens[tokenId];
        
        // Condition 1: Token 1's mint anniversary (for ALL tokens)
        // Token 1 always exists if any token exists
        if (_nextTokenId > 1) {
            TokenData memory token1 = tokens[1];
            if (_isSameMonthAndDay(timestamp, token1.mintTimestamp)) {
                return true;
            }
        }
        
        // Condition 2: Token's own mint anniversary
        if (_isSameMonthAndDay(timestamp, token.mintTimestamp)) {
            return true;
        }
        
        // Condition 3: Milestone token anniversaries (only if those tokens exist)
        // Token 100
        if (_nextTokenId > MILESTONE_100) {
            TokenData memory token100 = tokens[MILESTONE_100];
            if (_isSameMonthAndDay(timestamp, token100.mintTimestamp)) {
                return true;
            }
        }
        
        // Token 500
        if (_nextTokenId > MILESTONE_500) {
            TokenData memory token500 = tokens[MILESTONE_500];
            if (_isSameMonthAndDay(timestamp, token500.mintTimestamp)) {
                return true;
            }
        }
        
        // Token 750
        if (_nextTokenId > MILESTONE_750) {
            TokenData memory token750 = tokens[MILESTONE_750];
            if (_isSameMonthAndDay(timestamp, token750.mintTimestamp)) {
                return true;
            }
        }
        
        // Token 999
        if (_nextTokenId > MILESTONE_999) {
            TokenData memory token999 = tokens[MILESTONE_999];
            if (_isSameMonthAndDay(timestamp, token999.mintTimestamp)) {
                return true;
            }
        }
        
        return false;
    }

    // ============ View Functions ============

    /**
     * @dev Get all mutations for a token
     * @param tokenId Token to query
     * @return Array of mutation records
     */
    function getTokenMutations(uint256 tokenId) external view returns (MutationRecord[] memory) {
        return tokenMutations[tokenId];
    }

    /**
     * @dev Get custom palette for a token (if exists)
     * @param tokenId Token to query
     * @return Array of 6 colors or empty strings if no custom palette
     */
    function getCustomPalette(uint256 tokenId) external view returns (string[6] memory) {
        return customPalettes[tokenId];
    }

    /**
     * @dev Get the current pending mint request
     * @return Full MintRequest struct with seeds array
     * @notice Since only one request can be active at a time, no address parameter needed
     */
    function getPendingRequest() external view returns (MintRequest memory) {
        return pendingRequest;
    }

    /**
     * @dev Check if a mint selection is currently in progress (blocks all minting)
     * @return active True if there's an active selection in progress
     * @return requester Address with the active selection (or address(0))
     * @return expiresAt Timestamp when the selection window expires
     */
    function isMintSelectionInProgress() external view returns (
        bool active,
        address requester,
        uint256 expiresAt
    ) {
        if (activeMintRequester != address(0) && 
            block.timestamp <= activeMintRequestTime + REQUEST_EXPIRATION) {
            return (true, activeMintRequester, activeMintRequestTime + REQUEST_EXPIRATION);
        }
        return (false, address(0), 0);
    }

    /**
     * @dev Get allowed mutation types
     * @return Array of mutation type names
     */
    function getAllowedMutations() external view returns (string[] memory) {
        return allowedMutations;
    }

    /**
     * @dev Get current mint price
     * @return Current price in wei
     */
    function getCurrentPrice() external view returns (uint256) {
        return ExponentialPricing.calculatePrice(_nextTokenId, OWNER_RESERVE);
    }

    /**
     * @dev Get total supply minted
     * @return Number of tokens minted
     */
    function totalSupply() public view override returns (uint256) {
        return _nextTokenId - 1;
    }

    // ============ EIP-2981 Royalty Functions ============

    /**
     * @notice Returns royalty information for a token sale
     * @dev Implements EIP-2981 standard for NFT royalties
     * @param tokenId The token being sold
     * @param salePrice The sale price of the token
     * @return receiver Address that should receive the royalty payment
     * @return royaltyAmount Amount of royalty to be paid (in same currency as salePrice)
     */
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        // Calculate 5% royalty
        royaltyAmount = (salePrice * ROYALTY_BPS) / 10_000;
        receiver = royaltyReceiver;
        
        return (receiver, royaltyAmount);
    }

    /**
     * @notice Update the royalty receiver address
     * @dev Only callable by contract owner
     * @param newReceiver New address to receive royalty payments
     */
    function setRoyaltyReceiver(address newReceiver) external onlyOwner {
        require(newReceiver != address(0), "Invalid receiver address");
        royaltyReceiver = newReceiver;
        emit RoyaltyReceiverUpdated(newReceiver);
    }

    /**
     * @notice Check if contract supports a given interface
     * @dev Overrides ERC721Enumerable to add ERC2981 support
     * @param interfaceId The interface identifier to check
     * @return True if interface is supported
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns metadata for OpenSea and other marketplaces
     * @dev Points to API URLs which call the on-chain generator contract
     * 
     * Architecture:
     * - This returns JSON with HTTP URLs
     * - URLs point to API wrapper service
     * - API calls SpattersGenerator.getTokenHtml() (fully on-chain)
     * - Same model as Art Blocks!
     * 
     * @param tokenId The token ID
     * @return Metadata URL (baseURI + tokenId)
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(bytes(baseURI).length > 0, "baseURI not set - owner must call setBaseURI");
        
        return string(abi.encodePacked(baseURI, tokenId.toString()));
    }

    // ============ Internal Functions ============

    /**
     * @dev Generate pseudo-random seed
     */
    function _generateSeed(
        address minter,
        uint256 timestamp,
        uint8 nonce
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(
            minter,
            timestamp,
            block.prevrandao,
            _nextTokenId,
            nonce
        ));
    }

    /**
     * @dev Generate deterministic mutation seed
     * CRITICAL: Includes msg.sender so each owner gets unique mutations
     */
    function _generateMutationSeed(
        uint256 tokenId,
        uint256 mutationIndex,
        string memory mutationType
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(
            tokenId,
            msg.sender,          // CRITICAL: Current owner's address
            mutationIndex,
            mutationType,
            block.timestamp,
            block.prevrandao
        ));
    }

    /**
     * @dev Validate hex color format
     */
    function _isValidHexColor(string memory color) internal pure returns (bool) {
        bytes memory b = bytes(color);
        if (b.length != 7) return false;
        if (b[0] != '#') return false;
        
        for (uint i = 1; i < 7; i++) {
            bytes1 char = b[i];
            if (!(
                (char >= '0' && char <= '9') ||
                (char >= 'a' && char <= 'f') ||
                (char >= 'A' && char <= 'F')
            )) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * @dev Check if mutation type is valid (O(1) lookup via hash mapping)
     */
    function _isValidMutationType(string memory mutationType) internal view returns (bool) {
        return _mutationTypeHashes[keccak256(bytes(mutationType))];
    }

    /**
     * @dev Check if two timestamps have the same month and day (for anniversary checking)
     * This compares month/day regardless of year
     */
    function _isSameMonthAndDay(uint256 timestamp1, uint256 timestamp2) internal pure returns (bool) {
        DateTime.DateTime memory dt1 = DateTime.parseTimestamp(timestamp1);
        DateTime.DateTime memory dt2 = DateTime.parseTimestamp(timestamp2);
        return dt1.month == dt2.month && dt1.day == dt2.day;
    }

    // ============ Withdrawal ============

    /**
     * @dev Withdraw collected mint fees
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    // ============ Community Governance Functions ============
    
    /**
     * @notice Owner can update baseURI at any time
     * @param newURI New base URI for token metadata
     */
    function setBaseURI(string memory newURI) external onlyOwner {
        baseURI = newURI;
        emit BaseURIUpdatedByOwner(newURI);
    }
    
    /**
     * @notice Update the Generator contract reference (informational only)
     * @dev This is purely for discoverability - this contract never calls the Generator
     *      Can only be called before lockGenerator() is called
     * @param _generator Address of the new Generator contract
     */
    function setGeneratorContract(address _generator) external onlyOwner {
        require(!generatorLocked, "Generator is permanently locked");
        address oldGenerator = generatorContract;
        generatorContract = _generator;
        emit GeneratorContractUpdated(oldGenerator, _generator);
    }
    
    /**
     * @notice Permanently lock the generator contract reference
     * @dev Once called, setGeneratorContract() can never be called again
     *      This provides collectors with cryptographic proof that the rendering
     *      infrastructure will never change (Art Blocks-style immutability)
     * 
     * WARNING: This is IRREVERSIBLE. Ensure the generator is fully tested
     *          and working correctly before calling this function.
     */
    function lockGenerator() external onlyOwner {
        require(!generatorLocked, "Already locked");
        require(generatorContract != address(0), "Set generator before locking");
        generatorLocked = true;
        emit GeneratorPermanentlyLocked(generatorContract);
    }
    
    /**
     * @notice Propose a new baseURI (available after 10 years)
     * @dev Any token holder can propose once every 30 days
     *      Tokens that previously made failed proposals are banned until a proposal succeeds
     * @param newURI Proposed new base URI
     */
    function proposeBaseURI(string memory newURI) external {
        require(block.timestamp >= deploymentTime + GOVERNANCE_DELAY, "Governance not active yet");
        require(balanceOf(msg.sender) > 0, "Must own a Spatter");
        require(bytes(newURI).length > 0, "URI cannot be empty");
        
        // Check if current proposal is expired
        bool votingExpired = currentProposal.locked && 
            block.timestamp > currentProposal.proposalTime + VOTING_PERIOD;
        bool confirmationExpired = currentProposal.thresholdReached && 
            block.timestamp > currentProposal.thresholdReachedTime + CONFIRMATION_WINDOW;
        bool currentExpired = votingExpired || confirmationExpired;
        
        require(!currentProposal.locked || currentExpired, "Active proposal in progress");
        require(block.timestamp >= lastProposalTime + PROPOSAL_COOLDOWN, "Proposal cooldown active");
        
        // Handle expired proposal - ban the proposer's token
        if (currentExpired && currentProposal.proposerTokenId != 0) {
            _handleExpiredProposal();
        }
        
        // Find a non-banned token owned by proposer
        uint256 proposerToken = _findNonBannedToken(msg.sender);
        require(proposerToken != 0, "All your tokens are banned from proposing");
        
        // Increment generation to invalidate previous votes (O(1) clearing)
        proposalGeneration++;
        
        // Create new proposal
        currentProposal = CommunityProposal({
            proposer: msg.sender,
            proposedBaseURI: newURI,
            proposalTime: block.timestamp,
            totalVotesWeight: 0,
            locked: false,
            thresholdReached: false,
            thresholdReachedTime: 0,
            executed: false,
            proposerTokenId: proposerToken
        });
        
        lastProposalTime = block.timestamp;
        
        emit ProposalCreated(msg.sender, newURI, block.timestamp, proposerToken);
    }
    
    /**
     * @notice Vote to approve the current proposal
     * @dev First vote locks the proposal to prevent frontrunning
     *      Votes are tracked by token ID, not address, to prevent double-voting via transfer
     */
    function approveProposal() external {
        require(block.timestamp >= deploymentTime + GOVERNANCE_DELAY, "Governance not active yet");
        require(currentProposal.proposalTime > 0, "No active proposal");
        require(!currentProposal.executed, "Proposal already executed");
        
        // Check voting period hasn't expired
        require(
            block.timestamp <= currentProposal.proposalTime + VOTING_PERIOD,
            "Voting period expired"
        );
        
        // Check confirmation window if threshold reached
        require(!currentProposal.thresholdReached || 
                block.timestamp <= currentProposal.thresholdReachedTime + CONFIRMATION_WINDOW,
                "Confirmation window expired");
        
        uint256 voterTokenCount = balanceOf(msg.sender);
        require(voterTokenCount > 0, "Must own a Spatter");
        
        // Lock proposal on first vote (prevents frontrunning attacks)
        if (!currentProposal.locked) {
            currentProposal.locked = true;
            emit ProposalLocked(currentProposal.proposedBaseURI);
        }
        
        // Count votes from tokens that haven't voted in this generation
        uint256 newVotes = 0;
        for (uint256 i = 0; i < voterTokenCount; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(msg.sender, i);
            if (tokenVoteGeneration[tokenId] != proposalGeneration) {
                tokenVoteGeneration[tokenId] = proposalGeneration;
                newVotes++;
            }
        }
        
        require(newVotes > 0, "All your tokens already voted");
        
        currentProposal.totalVotesWeight += newVotes;
        
        emit VoteCast(msg.sender, newVotes);
        
        // Check if 67% threshold reached
        uint256 totalMinted = _nextTokenId - 1;
        uint256 requiredVotes = (totalMinted * 67) / 100;
        
        if (!currentProposal.thresholdReached && currentProposal.totalVotesWeight >= requiredVotes) {
            currentProposal.thresholdReached = true;
            currentProposal.thresholdReachedTime = block.timestamp;
            emit ProposalThresholdReached(currentProposal.proposedBaseURI, block.timestamp);
        }
    }
    
    /**
     * @notice Confirm and execute proposal (only callable by original proposer)
     * @dev Must be called within 48 hours of threshold being reached
     *      On success, all token bans are cleared via O(1) generation increment
     */
    function confirmProposal() external {
        require(msg.sender == currentProposal.proposer, "Only proposer can confirm");
        require(currentProposal.thresholdReached, "Threshold not reached");
        require(!currentProposal.executed, "Already executed");
        require(
            block.timestamp <= currentProposal.thresholdReachedTime + CONFIRMATION_WINDOW,
            "Proposal expired - window closed"
        );
        
        // Execute the change
        baseURI = currentProposal.proposedBaseURI;
        currentProposal.executed = true;
        
        // Clear all token bans via O(1) generation increment
        // All tokens with tokenBanGeneration[id] == old banGeneration are now unbanned
        banGeneration++;
        emit AllProposalBansCleared(banGeneration);
        
        // Increment vote generation to invalidate votes (O(1) clearing)
        proposalGeneration++;
        
        emit BaseURIUpdatedByCommunity(currentProposal.proposedBaseURI);
    }
    
    /**
     * @dev Internal function to handle expired proposals
     *      Bans the proposer's token from making future proposals
     */
    function _handleExpiredProposal() internal {
        uint256 tokenId = currentProposal.proposerTokenId;
        // Ban the token by setting its ban generation to current
        if (tokenId != 0 && tokenBanGeneration[tokenId] != banGeneration) {
            tokenBanGeneration[tokenId] = banGeneration;
            emit TokenBannedFromProposing(tokenId);
        }
        emit ProposalExpired(currentProposal.proposedBaseURI, tokenId);
    }
    
    /**
     * @dev Find a non-banned token owned by an address
     * @param owner Address to check tokens for
     * @return tokenId First non-banned token ID, or 0 if all are banned
     */
    function _findNonBannedToken(address owner) internal view returns (uint256) {
        uint256 tokenCount = balanceOf(owner);
        for (uint256 i = 0; i < tokenCount; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(owner, i);
            // Token is banned if its ban generation matches current ban generation
            if (tokenBanGeneration[tokenId] != banGeneration) {
                return tokenId;
            }
        }
        return 0;
    }
    
    /**
     * @notice Get current proposal details
     */
    function getCurrentProposal() external view returns (
        address proposer,
        string memory proposedURI,
        uint256 proposalTime,
        uint256 totalVotes,
        bool locked,
        bool thresholdReached,
        uint256 thresholdTime,
        bool executed,
        uint256 proposerTokenId
    ) {
        return (
            currentProposal.proposer,
            currentProposal.proposedBaseURI,
            currentProposal.proposalTime,
            currentProposal.totalVotesWeight,
            currentProposal.locked,
            currentProposal.thresholdReached,
            currentProposal.thresholdReachedTime,
            currentProposal.executed,
            currentProposal.proposerTokenId
        );
    }
    
    /**
     * @notice Check if a specific token is banned from proposing
     * @dev Token is banned if its ban generation matches current ban generation
     * @param tokenId Token ID to check
     */
    function isTokenBanned(uint256 tokenId) external view returns (bool) {
        return tokenBanGeneration[tokenId] == banGeneration;
    }
    
    /**
     * @notice Check if a token has voted in the current proposal
     * @param tokenId Token ID to check
     */
    function hasTokenVoted(uint256 tokenId) external view returns (bool) {
        return tokenVoteGeneration[tokenId] == proposalGeneration;
    }
}
