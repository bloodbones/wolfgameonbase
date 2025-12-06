// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "./interfaces/IWoolf.sol";
import "./interfaces/IBarn.sol";
import "./interfaces/ITraits.sol";
import "./Wool.sol";

/**
 * @title Woolf - Wolf Game NFT Contract
 * @notice ERC721 NFTs representing Sheep and Wolves
 * @dev Adapted from original Wolf Game with Chainlink VRF v2.5 for secure randomness
 *
 * === HOW MINTING WORKS ===
 *
 * 1. User calls mint(amount, stake)
 * 2. Contract requests random number from Chainlink VRF
 * 3. Chainlink calls back fulfillRandomWords() with the random number
 * 4. Contract generates traits and mints the NFT(s)
 *
 * This 2-step process prevents manipulation - you can't predict what you'll get.
 *
 * === TOKENOMICS ===
 *
 * Gen 0 (tokens 1-10,000): Paid with ETH (0.001 ETH on testnet)
 * Gen 1 (tokens 10,001-20,000): Costs 20,000 WOOL each
 * Gen 2 (tokens 20,001-40,000): Costs 40,000 WOOL each
 * Gen 3 (tokens 40,001-50,000): Costs 80,000 WOOL each
 *
 * === SPECIES ===
 *
 * 90% chance = Sheep (earns WOOL when staked)
 * 10% chance = Wolf (steals WOOL from sheep, can steal new mints)
 *
 * === STEAL MECHANIC ===
 *
 * When minting Gen 1+, there's a 10% chance your NFT goes to a random
 * staked wolf owner instead of you. High risk, high reward gameplay.
 */
contract Woolf is IWoolf, ERC721Enumerable, Pausable, ReentrancyGuard, VRFConsumerBaseV2Plus {

    // ============================================
    // CONSTANTS
    // ============================================

    /// @notice Price to mint Gen 0 NFT (testnet price - mainnet was 0.069420 ETH)
    uint256 public constant MINT_PRICE = 0.001 ether;

    /// @notice Maximum total supply
    uint256 public immutable MAX_TOKENS;

    /// @notice Number of Gen 0 tokens (20% of max, paid with ETH)
    uint256 public PAID_TOKENS;

    // ============================================
    // CHAINLINK VRF V2.5 CONFIGURATION
    // ============================================
    //
    // WHY VRF? The original Wolf Game used blockhash for randomness, which
    // could be manipulated by miners/validators. VRF provides cryptographic
    // proof that the random number wasn't tampered with.
    //
    // HOW IT WORKS:
    // 1. We request a random number (costs LINK tokens)
    // 2. Chainlink generates it off-chain with a private key
    // 3. They submit it on-chain with a proof
    // 4. The proof is verified - if invalid, the tx reverts
    //
    // Base Sepolia VRF values from: https://docs.chain.link/vrf/v2-5/supported-networks

    /// @notice VRF Coordinator address (Base Sepolia)
    /// @dev IMPORTANT: Verify this at https://vrf.chain.link before mainnet deploy
    // Base Sepolia coordinator - check docs.chain.link for latest

    /// @notice Subscription ID for VRF (you create this at vrf.chain.link)
    uint256 public s_subscriptionId;

    /// @notice Gas lane key hash - determines max gas price for VRF callback
    /// @dev 30 gwei lane on Base Sepolia
    bytes32 public constant KEY_HASH = 0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71;

    /// @notice Max gas for the callback function
    /// @dev 2.5M is max for Base Sepolia. Needs to cover minting up to 10 NFTs.
    uint32 public constant CALLBACK_GAS_LIMIT = 2500000;

    /// @notice Blocks to wait before VRF fulfillment (more = more secure)
    uint16 public constant REQUEST_CONFIRMATIONS = 3;

    // ============================================
    // STATE VARIABLES
    // ============================================

    /// @notice Number of tokens minted so far
    uint16 public minted;

    /// @notice Token ID => traits
    mapping(uint256 => SheepWolf) public tokenTraits;

    /// @notice Hash of traits => token ID (prevents duplicate trait combinations)
    mapping(uint256 => uint256) public existingCombinations;

    /// @notice VRF request ID => pending mint info
    mapping(uint256 => PendingMint) public pendingMints;

    /// @notice Reference to Barn contract (staking)
    IBarn public barn;

    /// @notice Reference to WOOL token
    Wool public wool;

    /// @notice Reference to Traits contract (SVG generation)
    ITraits public traits;

    // ============================================
    // GEN 0 MINT LIMIT
    // ============================================

    /// @notice Maximum Gen 0 mints per wallet (for wider distribution)
    uint256 public maxGen0PerWallet = 10;

    /// @notice Tracks Gen 0 mints per wallet
    mapping(address => uint256) public gen0MintCount;

    // ============================================
    // TRAIT RARITY TABLES
    // ============================================
    //
    // These use "A.J. Walker's Alias Algorithm" for O(1) random selection.
    // Instead of looping through probabilities, we use two lookup tables.
    //
    // Example: To pick a random fur type:
    // 1. Pick random index into rarities array
    // 2. Pick random number 0-255
    // 3. If random < rarities[index], use that trait
    // 4. Otherwise, use aliases[index] as the trait
    //
    // This gives weighted random selection in constant time.
    // The tables are generated off-chain based on desired rarity weights.

    /// @notice Rarity values for Walker's Alias algorithm
    /// @dev Indices 0-8 = Sheep traits, 9-17 = Wolf traits
    uint8[][18] public rarities;

    /// @notice Alias values for Walker's Alias algorithm
    uint8[][18] public aliases;

    // ============================================
    // STRUCTS
    // ============================================

    /// @notice Stores pending mint waiting for VRF callback
    struct PendingMint {
        address minter;     // Who requested the mint
        uint256 amount;     // How many NFTs
        bool stake;         // Whether to auto-stake after mint
        bool fulfilled;     // Whether VRF has responded
    }

    // ============================================
    // EVENTS
    // ============================================

    event MintRequested(uint256 indexed requestId, address indexed minter, uint256 amount, bool stake);
    event MintFulfilled(uint256 indexed requestId, address indexed minter, uint256[] tokenIds);
    event TokenStolen(uint256 indexed tokenId, address indexed from, address indexed to);

    // ============================================
    // CONSTRUCTOR
    // ============================================

    /**
     * @param _wool Address of WOOL token contract
     * @param _traits Address of Traits contract (can be address(0) initially)
     * @param _maxTokens Maximum total supply (50,000 for production)
     * @param _vrfCoordinator Chainlink VRF Coordinator address
     * @param _subscriptionId Your VRF subscription ID
     */
    constructor(
        address _wool,
        address _traits,
        uint256 _maxTokens,
        address _vrfCoordinator,
        uint256 _subscriptionId
    )
        ERC721("Wolf Game", "WGAME")
        VRFConsumerBaseV2Plus(_vrfCoordinator)
    {
        // SECURITY FIX (LOW-2): Zero-address validation
        require(_wool != address(0), "Wool address cannot be zero");
        require(_vrfCoordinator != address(0), "VRF coordinator cannot be zero");
        require(_maxTokens > 0, "Max tokens must be > 0");

        wool = Wool(_wool);
        traits = ITraits(_traits);  // Can be zero initially, set later
        MAX_TOKENS = _maxTokens;
        PAID_TOKENS = _maxTokens / 5; // 20% are Gen 0
        s_subscriptionId = _subscriptionId;

        // Initialize rarity tables (same as original Wolf Game)
        // These determine how rare each trait variant is
        _initializeRarityTables();
    }

    /**
     * @dev Initialize the Walker's Alias tables for trait generation
     * These values are from the original Wolf Game
     */
    function _initializeRarityTables() internal {
        // === SHEEP TRAITS (indices 0-8) ===

        // Fur (5 variants, varying rarity)
        rarities[0] = [15, 50, 200, 250, 255];
        aliases[0] = [4, 4, 4, 4, 4];

        // Head (20 variants)
        rarities[1] = [190, 215, 240, 100, 110, 135, 160, 185, 80, 210, 235, 240, 80, 80, 100, 100, 100, 245, 250, 255];
        aliases[1] = [1, 2, 4, 0, 5, 6, 7, 9, 0, 10, 11, 17, 0, 0, 0, 0, 4, 18, 19, 19];

        // Ears (6 variants)
        rarities[2] = [255, 30, 60, 60, 150, 156];
        aliases[2] = [0, 0, 0, 0, 0, 0];

        // Eyes (28 variants - lots of variety!)
        rarities[3] = [221, 100, 181, 140, 224, 147, 84, 228, 140, 224, 250, 160, 241, 207, 173, 84, 254, 220, 196, 140, 168, 252, 140, 183, 236, 252, 224, 255];
        aliases[3] = [1, 2, 5, 0, 1, 7, 1, 10, 5, 10, 11, 12, 13, 14, 16, 11, 17, 23, 13, 14, 17, 23, 23, 24, 27, 27, 27, 27];

        // Nose (10 variants)
        rarities[4] = [175, 100, 40, 250, 115, 100, 185, 175, 180, 255];
        aliases[4] = [3, 0, 4, 6, 6, 7, 8, 8, 9, 9];

        // Mouth (16 variants)
        rarities[5] = [80, 225, 227, 228, 112, 240, 64, 160, 167, 217, 171, 64, 240, 126, 80, 255];
        aliases[5] = [1, 2, 3, 8, 2, 8, 8, 9, 9, 10, 13, 10, 13, 15, 13, 15];

        // Neck (1 variant - all sheep have same neck)
        rarities[6] = [255];
        aliases[6] = [0];

        // Feet (19 variants)
        rarities[7] = [243, 189, 133, 133, 57, 95, 152, 135, 133, 57, 222, 168, 57, 57, 38, 114, 114, 114, 255];
        aliases[7] = [1, 7, 0, 0, 0, 0, 0, 10, 0, 0, 11, 18, 0, 0, 0, 1, 7, 11, 18];

        // Alpha Index (1 variant - sheep don't have alpha)
        rarities[8] = [255];
        aliases[8] = [0];

        // === WOLF TRAITS (indices 9-17) ===

        // Fur (9 variants, some very rare)
        rarities[9] = [210, 90, 9, 9, 9, 150, 9, 255, 9];
        aliases[9] = [5, 0, 0, 5, 5, 7, 5, 7, 5];

        // Head (1 variant)
        rarities[10] = [255];
        aliases[10] = [0];

        // Ears (1 variant)
        rarities[11] = [255];
        aliases[11] = [0];

        // Eyes (27 variants)
        rarities[12] = [135, 177, 219, 141, 183, 225, 147, 189, 231, 135, 135, 135, 135, 246, 150, 150, 156, 165, 171, 180, 186, 195, 201, 210, 243, 252, 255];
        aliases[12] = [1, 2, 3, 4, 5, 6, 7, 8, 13, 3, 6, 14, 15, 16, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 26, 26];

        // Nose (1 variant)
        rarities[13] = [255];
        aliases[13] = [0];

        // Mouth (13 variants)
        rarities[14] = [239, 244, 249, 234, 234, 234, 234, 234, 234, 234, 130, 255, 247];
        aliases[14] = [1, 2, 11, 0, 11, 11, 11, 11, 11, 11, 11, 11, 11];

        // Neck (15 variants)
        rarities[15] = [75, 180, 165, 120, 60, 150, 105, 195, 45, 225, 75, 45, 195, 120, 255];
        aliases[15] = [1, 9, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 14, 12, 14];

        // Feet (1 variant)
        rarities[16] = [255];
        aliases[16] = [0];

        // Alpha Index (4 variants: determines wolf strength 5-8)
        // Lower index = higher alpha = more earnings
        rarities[17] = [8, 160, 73, 255];
        aliases[17] = [2, 3, 3, 3];
    }

    // ============================================
    // MINTING (Step 1: Request)
    // ============================================

    /**
     * @notice Request to mint NFTs
     * @param amount Number of NFTs to mint (1-10)
     * @param stake Whether to automatically stake after minting
     * @dev This starts the VRF process. Actual minting happens in fulfillRandomWords()
     *
     * FLOW:
     * 1. User calls mint() with ETH (Gen 0) or WOOL approval (Gen 1+)
     * 2. We burn WOOL if needed and request VRF random number
     * 3. Chainlink nodes generate random number off-chain
     * 4. Chainlink calls fulfillRandomWords() with the result
     * 5. We generate traits and mint NFTs in that callback
     *
     * WHY TWO STEPS? If we did it in one transaction, miners could:
     * - See what traits they'd get
     * - Only include the tx if they get a wolf
     * With VRF, the random number isn't known until after you've committed.
     */
    function mint(uint256 amount, bool stake) external payable nonReentrant whenNotPaused {
        _mintWithMaxCost(amount, stake, type(uint256).max);
    }

    /**
     * @notice Request to mint NFTs with slippage protection
     * @param amount Number of NFTs to mint (1-10)
     * @param stake Whether to automatically stake after minting
     * @param maxWoolCost Maximum WOOL to spend (for slippage protection on Gen 1+)
     * @dev SECURITY FIX (MED-1): Prevents paying more than expected if `minted` changes
     */
    function mintWithMaxCost(uint256 amount, bool stake, uint256 maxWoolCost) external payable nonReentrant whenNotPaused {
        _mintWithMaxCost(amount, stake, maxWoolCost);
    }

    /**
     * @notice Internal mint logic shared by mint() and mintWithMaxCost()
     * @dev No nonReentrant here - called from nonReentrant entry points
     */
    function _mintWithMaxCost(uint256 amount, bool stake, uint256 maxWoolCost) internal {
        require(tx.origin == msg.sender, "Only EOA"); // No contracts (prevents some exploits)
        require(minted + amount <= MAX_TOKENS, "All tokens minted");
        require(amount > 0 && amount <= 10, "Invalid mint amount");

        // === PAYMENT ===
        if (minted < PAID_TOKENS) {
            // Gen 0: Pay with ETH
            require(minted + amount <= PAID_TOKENS, "All Gen 0 sold");
            require(msg.value == amount * MINT_PRICE, "Wrong ETH amount");
            // Enforce per-wallet limit for Gen 0 (wider distribution)
            require(gen0MintCount[msg.sender] + amount <= maxGen0PerWallet, "Gen 0 wallet limit reached");
            gen0MintCount[msg.sender] += amount;
        } else {
            // Gen 1+: Pay with WOOL (must have approved this contract)
            require(msg.value == 0, "Don't send ETH for Gen 1+");
            uint256 totalWoolCost = 0;
            for (uint256 i = 0; i < amount; i++) {
                totalWoolCost += mintCost(minted + 1 + i);
            }
            // SECURITY FIX (MED-1): Slippage protection
            require(totalWoolCost <= maxWoolCost, "WOOL cost exceeds max");
            // Burn the WOOL (requires user to have approved this contract)
            wool.burn(msg.sender, totalWoolCost);
        }

        // === REQUEST VRF ===
        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: KEY_HASH,
                subId: s_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: 1, // We only need 1 random number, we derive more from it
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false}) // Pay in LINK, not ETH
                )
            })
        );

        // Store pending mint info
        pendingMints[requestId] = PendingMint({
            minter: msg.sender,
            amount: amount,
            stake: stake,
            fulfilled: false
        });

        emit MintRequested(requestId, msg.sender, amount, stake);
    }

    /**
     * @notice Calculate WOOL cost for a token ID
     * @param tokenId The token ID to check
     * @return The WOOL cost (0 for Gen 0)
     *
     * Pricing tiers (with 50,000 max supply):
     * - Tokens 1-10,000: Free (paid with ETH)
     * - Tokens 10,001-20,000: 20,000 WOOL
     * - Tokens 20,001-40,000: 40,000 WOOL
     * - Tokens 40,001-50,000: 80,000 WOOL
     *
     * WHY INCREASING COST? Creates urgency to mint early, and ensures
     * WOOL from staking has value (you need it to mint more).
     */
    function mintCost(uint256 tokenId) public view returns (uint256) {
        if (tokenId <= PAID_TOKENS) return 0;
        if (tokenId <= MAX_TOKENS * 2 / 5) return 20000 ether;
        if (tokenId <= MAX_TOKENS * 4 / 5) return 40000 ether;
        return 80000 ether;
    }

    // ============================================
    // MINTING (Step 2: VRF Callback)
    // ============================================

    /**
     * @notice Chainlink VRF callback - generates and mints NFTs
     * @param requestId The VRF request ID
     * @param randomWords Array of random numbers (we requested 1)
     * @dev This is called by Chainlink, not by users
     *
     * WHAT HAPPENS HERE:
     * 1. Get the pending mint info
     * 2. For each NFT to mint:
     *    a. Derive a unique seed from the random number
     *    b. Generate traits (90% sheep, 10% wolf)
     *    c. Check for duplicate trait combinations
     *    d. Determine recipient (owner or stolen by wolf)
     *    e. Mint the NFT
     * 3. If stake=true, stake them in the Barn
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        PendingMint storage pending = pendingMints[requestId];
        require(!pending.fulfilled, "Already fulfilled");
        require(pending.minter != address(0), "Invalid request");

        pending.fulfilled = true;
        uint256 seed = randomWords[0];

        uint256[] memory tokenIds = new uint256[](pending.amount);
        uint16[] memory tokenIdsForStake = pending.stake ? new uint16[](pending.amount) : new uint16[](0);

        for (uint256 i = 0; i < pending.amount; i++) {
            minted++;
            uint256 tokenId = minted;

            // Derive unique seed for this token
            uint256 tokenSeed = uint256(keccak256(abi.encodePacked(seed, i)));

            // Generate traits (handles duplicates internally)
            _generate(tokenId, tokenSeed);

            // Determine recipient (pass minter since msg.sender is VRF coordinator)
            address recipient = _selectRecipient(tokenSeed, pending.minter);

            if (recipient != pending.minter) {
                emit TokenStolen(tokenId, pending.minter, recipient);
            }

            // Mint to recipient (or Barn if staking)
            if (!pending.stake || recipient != pending.minter) {
                _safeMint(recipient, tokenId);
                tokenIds[i] = tokenId;
            } else {
                _safeMint(address(barn), tokenId);
                tokenIdsForStake[i] = uint16(tokenId);
                tokenIds[i] = tokenId;
            }
        }

        // Stake if requested
        if (pending.stake && address(barn) != address(0)) {
            barn.addManyToBarnAndPack(pending.minter, tokenIdsForStake);
        }

        emit MintFulfilled(requestId, pending.minter, tokenIds);
    }

    // ============================================
    // TRAIT GENERATION
    // ============================================

    /**
     * @notice Generate traits for a token, ensuring uniqueness
     * @param tokenId The token ID
     * @param seed Random seed
     * @dev If traits already exist, recursively tries with new seed
     */
    function _generate(uint256 tokenId, uint256 seed) internal {
        SheepWolf memory t = _selectTraits(seed);
        uint256 hash = _structToHash(t);

        if (existingCombinations[hash] == 0) {
            // Unique combination - save it
            tokenTraits[tokenId] = t;
            existingCombinations[hash] = tokenId;
        } else {
            // Duplicate - try again with new seed
            // This is recursive but bounded by the number of possible combinations
            _generate(tokenId, uint256(keccak256(abi.encodePacked(seed))));
        }
    }

    /**
     * @notice Select traits based on random seed
     * @param seed 256-bit random number
     * @return t The generated traits
     *
     * HOW SPECIES IS DETERMINED:
     * - seed & 0xFFFF gives us 16 bits (0-65535)
     * - (seed & 0xFFFF) % 10 gives us 0-9
     * - If != 0, it's a sheep (90% chance)
     * - If == 0, it's a wolf (10% chance)
     */
    function _selectTraits(uint256 seed) internal view returns (SheepWolf memory t) {
        // 90% sheep, 10% wolf
        t.isSheep = (seed & 0xFFFF) % 10 != 0;

        // Offset into rarity tables (0 for sheep, 9 for wolf)
        uint8 shift = t.isSheep ? 0 : 9;

        // Use different bits of seed for each trait to avoid correlation
        seed >>= 16;
        t.fur = _selectTrait(uint16(seed & 0xFFFF), 0 + shift);
        seed >>= 16;
        t.head = _selectTrait(uint16(seed & 0xFFFF), 1 + shift);
        seed >>= 16;
        t.ears = _selectTrait(uint16(seed & 0xFFFF), 2 + shift);
        seed >>= 16;
        t.eyes = _selectTrait(uint16(seed & 0xFFFF), 3 + shift);
        seed >>= 16;
        t.nose = _selectTrait(uint16(seed & 0xFFFF), 4 + shift);
        seed >>= 16;
        t.mouth = _selectTrait(uint16(seed & 0xFFFF), 5 + shift);
        seed >>= 16;
        t.neck = _selectTrait(uint16(seed & 0xFFFF), 6 + shift);
        seed >>= 16;
        t.feet = _selectTrait(uint16(seed & 0xFFFF), 7 + shift);
        seed >>= 16;
        t.alphaIndex = _selectTrait(uint16(seed & 0xFFFF), 8 + shift);
    }

    /**
     * @notice Use Walker's Alias algorithm for O(1) weighted random selection
     * @param seed 16-bit random value
     * @param traitType Which trait table to use (0-17)
     * @return The selected trait index
     *
     * WALKER'S ALIAS ALGORITHM:
     * 1. Use low 8 bits to pick an index into the table
     * 2. Use high 8 bits as a threshold
     * 3. If threshold < rarities[index], return that index
     * 4. Otherwise, return aliases[index]
     *
     * This achieves weighted random selection in O(1) instead of O(n).
     * The pre-computed tables encode the probability distribution.
     */
    function _selectTrait(uint16 seed, uint8 traitType) internal view returns (uint8) {
        uint8 trait = uint8(seed) % uint8(rarities[traitType].length);
        if (seed >> 8 < rarities[traitType][trait]) return trait;
        return aliases[traitType][trait];
    }

    /**
     * @notice Hash traits to check for duplicates
     */
    function _structToHash(SheepWolf memory s) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(
            s.isSheep,
            s.fur,
            s.head,
            s.eyes,
            s.mouth,
            s.neck,
            s.ears,
            s.feet,
            s.alphaIndex
        )));
    }

    /**
     * @notice Determine who receives a newly minted token
     * @param seed Random seed
     * @param minter Original minter address (can't use msg.sender in VRF callback)
     * @return recipient Address to receive the token
     *
     * STEAL MECHANIC:
     * - Gen 0 tokens (first 20%): Always go to minter (no stealing)
     * - Gen 1+ tokens: 10% chance stolen by a random staked wolf
     *
     * This creates risk/reward gameplay and incentivizes wolf staking.
     */
    function _selectRecipient(uint256 seed, address minter) internal view returns (address) {
        // Gen 0 or no barn = no stealing
        if (minted <= PAID_TOKENS || address(barn) == address(0)) {
            return minter;
        }

        // 10% chance of being stolen (use bits 245-255 of seed)
        if ((seed >> 245) % 10 != 0) {
            return minter;
        }

        // Try to find a wolf to steal it
        address thief = barn.randomWolfOwner(seed >> 144);
        if (thief == address(0)) {
            return minter; // No wolves staked
        }

        return thief;
    }

    // ============================================
    // ERC721 OVERRIDES
    // ============================================

    /**
     * @notice Allow Barn to transfer without approval
     * @dev Saves users gas - they don't need to approve Barn separately
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override(ERC721, IERC721) {
        if (msg.sender != address(barn)) {
            require(_isAuthorized(from, msg.sender, tokenId), "Not approved");
        }
        _transfer(from, to, tokenId);
    }

    /**
     * @notice Get token metadata URI
     * @dev Delegates to Traits contract for on-chain SVG
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        if (address(traits) != address(0)) {
            return traits.tokenURI(tokenId);
        }

        // Fallback: basic metadata
        return string(abi.encodePacked(
            "data:application/json,{\"name\":\"",
            tokenTraits[tokenId].isSheep ? "Sheep" : "Wolf",
            " #", _toString(tokenId),
            "\",\"description\":\"Wolf Game on Base\"}"
        ));
    }

    // ============================================
    // VIEW FUNCTIONS (IWoolf interface)
    // ============================================

    function getTokenTraits(uint256 tokenId) external view override returns (SheepWolf memory) {
        return tokenTraits[tokenId];
    }

    function getPaidTokens() external view override returns (uint256) {
        return PAID_TOKENS;
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /**
     * @notice Set Barn contract address
     * @dev Call this after deploying Barn
     */
    function setBarn(address _barn) external onlyOwner {
        barn = IBarn(_barn);
    }

    /**
     * @notice Set Traits contract address
     * @dev Can upgrade art without redeploying NFT contract
     */
    function setTraits(address _traits) external onlyOwner {
        traits = ITraits(_traits);
    }

    /**
     * @notice Update paid tokens count (admin override)
     */
    function setPaidTokens(uint256 _paidTokens) external onlyOwner {
        PAID_TOKENS = _paidTokens;
    }

    /**
     * @notice Set max Gen 0 mints per wallet (can increase if mint is slow)
     */
    function setMaxGen0PerWallet(uint256 _maxGen0PerWallet) external onlyOwner {
        maxGen0PerWallet = _maxGen0PerWallet;
    }

    /**
     * @notice Update VRF subscription ID
     * @dev SECURITY FIX (HIGH-2): Allow changing subscription without redeploying
     */
    function setSubscriptionId(uint256 _subscriptionId) external onlyOwner {
        s_subscriptionId = _subscriptionId;
    }

    /**
     * @notice Pause/unpause minting
     */
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) _pause();
        else _unpause();
    }

    /**
     * @notice Withdraw ETH from Gen 0 mints
     */
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // ============================================
    // UTILITIES
    // ============================================

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
