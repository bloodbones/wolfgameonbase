// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "./interfaces/IWoolf.sol";
import "./interfaces/IBarn.sol";
import "./Wool.sol";

/**
 * @title Barn - Wolf Game Staking Contract
 * @notice Stake Sheep and Wolves to earn WOOL
 * @dev Uses Chainlink VRF for the unstaking randomness (50% sheep eaten)
 *
 * === HOW STAKING WORKS ===
 *
 * SHEEP:
 * - Earn 10,000 WOOL per day while staked
 * - When claiming (not unstaking): Pay 20% tax to wolves
 * - When unstaking: 50% chance all WOOL is stolen + sheep eaten
 * - Must stake minimum 2 days before unstaking
 *
 * WOLVES:
 * - Earn from the 20% tax pool
 * - Higher alpha (5-8) = larger share of earnings
 * - Can also steal newly minted NFTs (handled in Woolf.sol)
 *
 * === ALPHA SYSTEM ===
 *
 * Wolves have alpha scores from 5 (weakest) to 8 (strongest).
 * When tax is distributed:
 * - Total tax is divided by total alpha staked
 * - Each wolf earns (their alpha) * (tax per alpha point)
 *
 * Example: If 100 WOOL tax and total alpha is 20:
 * - Wolf with alpha 8 earns: 8 * (100/20) = 40 WOOL
 * - Wolf with alpha 5 earns: 5 * (100/20) = 25 WOOL
 *
 * === VRF FOR UNSTAKING ===
 *
 * Original Wolf Game used blockhash randomness for the "50% sheep eaten"
 * mechanic, which could be gamed. We use Chainlink VRF:
 *
 * 1. User calls claimManyFromBarnAndPack() with unstake=true
 * 2. If any sheep are unstaking, we request VRF
 * 3. Chainlink calls back with random number
 * 4. We determine which sheep survive and distribute tokens
 *
 * This is slower (requires callback) but prevents manipulation.
 */
contract Barn is IBarn, IERC721Receiver, Pausable, ReentrancyGuard, VRFConsumerBaseV2Plus {

    // ============================================
    // CONSTANTS
    // ============================================

    /// @notice Maximum alpha score for a wolf
    uint8 public constant MAX_ALPHA = 8;

    /// @notice WOOL earned per sheep per day (configurable)
    uint256 public dailyWoolRate = 10000 ether;

    /// @notice Minimum time before unstaking allowed (configurable)
    uint256 public minimumToExit = 2 days;

    /// @notice Tax percentage on sheep claims going to wolves (configurable)
    uint256 public woolClaimTaxPercentage = 20;

    /// @notice Chance (out of 100) that sheep is stolen when unstaking (configurable)
    /// @dev Default 50 = 50% chance of being stolen
    uint256 public sheepStealChance = 50;

    /// @notice Maximum total WOOL that can ever be earned
    /// @dev Prevents infinite inflation - game ends when this is reached
    uint256 public constant MAXIMUM_GLOBAL_WOOL = 2400000000 ether; // 2.4 billion

    // ============================================
    // CHAINLINK VRF V2.5
    // ============================================

    uint256 public s_subscriptionId;
    /// @dev 30 gwei lane on Base Sepolia
    bytes32 public constant KEY_HASH = 0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71;
    uint32 public constant CALLBACK_GAS_LIMIT = 2500000;
    uint16 public constant REQUEST_CONFIRMATIONS = 3;

    // ============================================
    // STRUCTS
    // ============================================

    /// @notice Info about a staked token
    struct Stake {
        uint16 tokenId;     // The token ID
        uint80 value;       // For sheep: timestamp of stake. For wolves: woolPerAlpha at stake time
        address owner;      // Who owns it
    }

    /// @notice Pending unstake request waiting for VRF
    struct PendingUnstake {
        address owner;              // Who requested
        uint16[] sheepIds;          // Sheep being unstaked
        uint16[] wolfIds;           // Wolves being unstaked
        uint256[] sheepOwed;        // WOOL owed per sheep (before 50/50)
        uint256[] wolfOwed;         // WOOL owed per wolf
        bool fulfilled;             // Whether VRF responded
    }

    // ============================================
    // STATE VARIABLES
    // ============================================

    /// @notice Reference to Woolf NFT contract
    IWoolf public woolf;

    /// @notice Reference to WOOL token
    Wool public wool;

    /// @notice Token ID => stake info (for both sheep and wolves)
    mapping(uint256 => Stake) public barn;

    /// @notice Alpha => array of wolf stakes with that alpha
    mapping(uint256 => Stake[]) public pack;

    /// @notice Token ID => index in pack array
    mapping(uint256 => uint256) public packIndices;

    /// @notice Owner => array of staked token IDs
    mapping(address => uint16[]) public stakedTokensByOwner;

    /// @notice Token ID => index in stakedTokensByOwner array
    mapping(uint256 => uint256) public stakedTokenIndex;

    /// @notice Total alpha of all staked wolves
    uint256 public totalAlphaStaked;

    /// @notice Accumulated tax that had no wolves to receive it
    uint256 public unaccountedRewards;

    /// @notice WOOL earned per alpha point (accumulator for wolf rewards)
    uint256 public woolPerAlpha;

    /// @notice Total WOOL earned globally (for cap enforcement)
    uint256 public totalWoolEarned;

    /// @notice Number of sheep currently staked
    uint256 public totalSheepStaked;

    /// @notice Last timestamp earnings were calculated
    uint256 public lastClaimTimestamp;

    /// @notice VRF request ID => pending unstake info
    mapping(uint256 => PendingUnstake) public pendingUnstakes;

    /// @notice Emergency rescue mode (allows unstaking without rewards)
    bool public rescueEnabled;

    /// @notice VRF request ID => timestamp when request was made (for rescue timeout)
    mapping(uint256 => uint256) public requestTimestamp;

    /// @notice Delay before rescue can be called for stuck VRF requests
    uint256 public constant RESCUE_DELAY = 1 hours;

    // ============================================
    // EVENTS
    // ============================================

    event TokenStaked(address indexed owner, uint256 indexed tokenId, uint256 value);
    event SheepClaimed(uint256 indexed tokenId, uint256 earned, bool unstaked, bool eaten);
    event WolfClaimed(uint256 indexed tokenId, uint256 earned, bool unstaked);
    event SheepStolen(uint256 indexed tokenId, address indexed from, address indexed to);
    event UnstakeRequested(uint256 indexed requestId, address indexed owner, uint256 sheepCount, uint256 wolfCount);
    event PendingUnstakeRescued(uint256 indexed requestId, address indexed owner);

    // Admin state change events (MED-5)
    event DailyWoolRateChanged(uint256 oldRate, uint256 newRate);
    event MinimumToExitChanged(uint256 oldTime, uint256 newTime);
    event WoolClaimTaxPercentageChanged(uint256 oldPercentage, uint256 newPercentage);
    event SheepStealChanceChanged(uint256 oldChance, uint256 newChance);
    event RescueEnabledChanged(bool enabled);

    // ============================================
    // CONSTRUCTOR
    // ============================================

    /**
     * @param _woolf Address of Woolf NFT contract
     * @param _wool Address of WOOL token contract
     * @param _vrfCoordinator Chainlink VRF Coordinator
     * @param _subscriptionId VRF subscription ID
     */
    constructor(
        address _woolf,
        address _wool,
        address _vrfCoordinator,
        uint256 _subscriptionId
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        // SECURITY FIX (LOW-2): Zero-address validation
        require(_woolf != address(0), "Woolf address cannot be zero");
        require(_wool != address(0), "Wool address cannot be zero");
        require(_vrfCoordinator != address(0), "VRF coordinator cannot be zero");

        woolf = IWoolf(_woolf);
        wool = Wool(_wool);
        s_subscriptionId = _subscriptionId;
        lastClaimTimestamp = block.timestamp;
    }

    // ============================================
    // STAKING
    // ============================================

    /**
     * @notice Stake multiple tokens (called directly or by Woolf during mint+stake)
     * @param account The token owner
     * @param tokenIds Array of token IDs to stake
     *
     * WHO CAN CALL THIS:
     * - Token owner directly (must transfer tokens first)
     * - Woolf contract (during mint+stake, tokens go directly to Barn)
     *
     * WHAT HAPPENS:
     * - Sheep go to the "barn" mapping, start earning WOOL
     * - Wolves go to the "pack" mapping, start earning from tax
     */
    function addManyToBarnAndPack(address account, uint16[] calldata tokenIds) external override whenNotPaused nonReentrant {
        // Only owner or Woolf contract can stake
        require(account == msg.sender || msg.sender == address(woolf), "Not authorized");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (tokenIds[i] == 0) continue; // Skip gaps (from stolen tokens)

            // If not called by Woolf, transfer token to this contract
            if (msg.sender != address(woolf)) {
                // Use low-level call since we need to handle the interface
                require(_ownerOf(tokenIds[i]) == msg.sender, "Not your token");
                _transferToSelf(msg.sender, tokenIds[i]);
            }

            if (_isSheep(tokenIds[i])) {
                _addSheepToBarn(account, tokenIds[i]);
            } else {
                _addWolfToPack(account, tokenIds[i]);
            }
        }
    }

    /**
     * @notice Add a sheep to the barn
     * @dev Updates global earnings before adding
     */
    function _addSheepToBarn(address account, uint256 tokenId) internal {
        _updateEarnings();

        barn[tokenId] = Stake({
            owner: account,
            tokenId: uint16(tokenId),
            value: uint80(block.timestamp) // Track when staked for earnings calc
        });
        totalSheepStaked++;

        // Track in owner's staked list
        stakedTokenIndex[tokenId] = stakedTokensByOwner[account].length;
        stakedTokensByOwner[account].push(uint16(tokenId));

        emit TokenStaked(account, tokenId, block.timestamp);
    }

    /**
     * @notice Add a wolf to the pack
     * @dev Wolves are grouped by alpha for weighted earnings
     */
    function _addWolfToPack(address account, uint256 tokenId) internal {
        uint256 alpha = _alphaForWolf(tokenId);
        totalAlphaStaked += alpha;

        // Store position in pack array
        packIndices[tokenId] = pack[alpha].length;

        pack[alpha].push(Stake({
            owner: account,
            tokenId: uint16(tokenId),
            value: uint80(woolPerAlpha) // Track woolPerAlpha at stake time
        }));

        // Track in owner's staked list
        stakedTokenIndex[tokenId] = stakedTokensByOwner[account].length;
        stakedTokensByOwner[account].push(uint16(tokenId));

        emit TokenStaked(account, tokenId, woolPerAlpha);
    }

    // ============================================
    // CLAIMING (No Unstake)
    // ============================================

    /**
     * @notice Claim WOOL without unstaking
     * @param tokenIds Tokens to claim for
     *
     * FOR SHEEP: Pays 20% tax to wolves, owner gets 80%
     * FOR WOLVES: Collects accumulated tax share
     *
     * This does NOT require VRF since there's no 50/50 risk.
     */
    function claimMany(uint16[] calldata tokenIds) external whenNotPaused nonReentrant {
        _updateEarnings();

        uint256 owed = 0;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (_isSheep(tokenIds[i])) {
                owed += _claimSheepRewards(tokenIds[i], false);
            } else {
                owed += _claimWolfRewards(tokenIds[i], false);
            }
        }

        if (owed > 0) {
            wool.mint(msg.sender, owed);
        }
    }

    /**
     * @notice Calculate and reset sheep earnings (claim only, no unstake)
     */
    function _claimSheepRewards(uint256 tokenId, bool unstaking) internal returns (uint256 owed) {
        Stake memory stake = barn[tokenId];
        require(stake.owner == msg.sender, "Not your sheep");

        // Calculate earnings
        if (totalWoolEarned < MAXIMUM_GLOBAL_WOOL) {
            owed = (block.timestamp - stake.value) * dailyWoolRate / 1 days;
        } else if (stake.value > lastClaimTimestamp) {
            owed = 0; // Staked after cap reached
        } else {
            owed = (lastClaimTimestamp - stake.value) * dailyWoolRate / 1 days;
        }

        if (!unstaking) {
            // Pay 20% tax to wolves
            _payWolfTax(owed * woolClaimTaxPercentage / 100);
            owed = owed * (100 - woolClaimTaxPercentage) / 100;

            // Reset stake timestamp
            barn[tokenId].value = uint80(block.timestamp);

            emit SheepClaimed(tokenId, owed, false, false);
        }
        // If unstaking, we don't emit here - wait for VRF callback

        return owed;
    }

    /**
     * @notice Calculate and optionally reset wolf earnings
     */
    function _claimWolfRewards(uint256 tokenId, bool unstaking) internal returns (uint256 owed) {
        uint256 alpha = _alphaForWolf(tokenId);
        Stake memory stake = pack[alpha][packIndices[tokenId]];
        require(stake.owner == msg.sender, "Not your wolf");

        // Wolf earnings = alpha * (current woolPerAlpha - woolPerAlpha at stake time)
        owed = alpha * (woolPerAlpha - stake.value);

        if (unstaking) {
            // Remove from pack
            totalAlphaStaked -= alpha;

            // SECURITY FIX (HIGH-4): Handle self-swap case when unstaking last element
            uint256 lastIndex = pack[alpha].length - 1;
            uint256 currentIndex = packIndices[tokenId];

            if (currentIndex != lastIndex) {
                // Swap with last element (only if not already last)
                Stake memory lastStake = pack[alpha][lastIndex];
                pack[alpha][currentIndex] = lastStake;
                packIndices[lastStake.tokenId] = currentIndex;
            }

            pack[alpha].pop();
            delete packIndices[tokenId];
        } else {
            // Reset claim point
            pack[alpha][packIndices[tokenId]].value = uint80(woolPerAlpha);
        }

        emit WolfClaimed(tokenId, owed, unstaking);
        return owed;
    }

    // ============================================
    // UNSTAKING (Requires VRF for Sheep)
    // ============================================

    /**
     * @notice Request to unstake tokens
     * @param tokenIds Tokens to unstake
     *
     * WHY VRF? When unstaking sheep, there's a 50% chance the sheep is
     * "eaten" - you lose all WOOL and the NFT goes to a wolf owner.
     *
     * With weak randomness, users could:
     * - Simulate the transaction
     * - Only submit if they win the 50/50
     *
     * VRF prevents this since the random number isn't known until callback.
     *
     * FLOW:
     * 1. User calls unstakeMany()
     * 2. We calculate owed amounts and request VRF
     * 3. Chainlink calls fulfillRandomWords()
     * 4. We determine winners/losers and distribute
     *
     * NOTE: Wolves don't have the 50/50 mechanic, but we batch them
     * with sheep for simpler UX (one transaction to unstake all).
     */
    function unstakeMany(uint16[] calldata tokenIds) external whenNotPaused nonReentrant {
        _updateEarnings();

        // Separate sheep and wolves
        uint16[] memory sheepIds = new uint16[](tokenIds.length);
        uint16[] memory wolfIds = new uint16[](tokenIds.length);
        uint256[] memory sheepOwed = new uint256[](tokenIds.length);
        uint256[] memory wolfOwed = new uint256[](tokenIds.length);
        uint256 sheepCount = 0;
        uint256 wolfCount = 0;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (_isSheep(tokenIds[i])) {
                Stake memory stake = barn[tokenIds[i]];
                require(stake.owner == msg.sender, "Not your sheep");
                require(block.timestamp - stake.value >= minimumToExit, "Still locked");

                // Calculate owed (before 50/50)
                uint256 owed;
                if (totalWoolEarned < MAXIMUM_GLOBAL_WOOL) {
                    owed = (block.timestamp - stake.value) * dailyWoolRate / 1 days;
                } else if (stake.value > lastClaimTimestamp) {
                    owed = 0;
                } else {
                    owed = (lastClaimTimestamp - stake.value) * dailyWoolRate / 1 days;
                }

                sheepIds[sheepCount] = tokenIds[i];
                sheepOwed[sheepCount] = owed;
                sheepCount++;
            } else {
                // Wolf - no VRF needed but include in batch
                wolfIds[wolfCount] = tokenIds[i];
                wolfOwed[wolfCount] = _claimWolfRewards(tokenIds[i], true);
                wolfCount++;
            }
        }

        // If only wolves, no VRF needed - process immediately
        if (sheepCount == 0) {
            uint256 totalWolfOwed = 0;
            for (uint256 i = 0; i < wolfCount; i++) {
                _removeFromStakedList(msg.sender, wolfIds[i]);
                _transferFromSelf(msg.sender, wolfIds[i]);
                totalWolfOwed += wolfOwed[i];
            }
            if (totalWolfOwed > 0) {
                wool.mint(msg.sender, totalWolfOwed);
            }
            return;
        }

        // Sheep present - need VRF for the 50/50
        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: KEY_HASH,
                subId: s_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: 1,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );

        // Trim arrays to actual size
        uint16[] memory trimmedSheepIds = new uint16[](sheepCount);
        uint256[] memory trimmedSheepOwed = new uint256[](sheepCount);
        uint16[] memory trimmedWolfIds = new uint16[](wolfCount);
        uint256[] memory trimmedWolfOwed = new uint256[](wolfCount);

        for (uint256 i = 0; i < sheepCount; i++) {
            trimmedSheepIds[i] = sheepIds[i];
            trimmedSheepOwed[i] = sheepOwed[i];
        }
        for (uint256 i = 0; i < wolfCount; i++) {
            trimmedWolfIds[i] = wolfIds[i];
            trimmedWolfOwed[i] = wolfOwed[i];
        }

        pendingUnstakes[requestId] = PendingUnstake({
            owner: msg.sender,
            sheepIds: trimmedSheepIds,
            wolfIds: trimmedWolfIds,
            sheepOwed: trimmedSheepOwed,
            wolfOwed: trimmedWolfOwed,
            fulfilled: false
        });

        // SECURITY FIX (CRIT-2): Track request timestamp for rescue mechanism
        requestTimestamp[requestId] = block.timestamp;

        emit UnstakeRequested(requestId, msg.sender, sheepCount, wolfCount);
    }

    /**
     * @notice VRF callback - determine sheep survival and distribute
     * @dev SECURITY FIX (CRIT-3): Follows Checks-Effects-Interactions pattern
     *      All state changes happen BEFORE external calls to prevent reentrancy
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        PendingUnstake storage pending = pendingUnstakes[requestId];
        require(!pending.fulfilled, "Already fulfilled");
        require(pending.owner != address(0), "Invalid request");

        // === CHECKS ===
        pending.fulfilled = true;
        uint256 seed = randomWords[0];
        uint256 totalOwed = 0;
        address owner = pending.owner;

        // Pre-calculate all outcomes and store recipients
        address[] memory sheepRecipients = new address[](pending.sheepIds.length);
        bool[] memory sheepSurvived = new bool[](pending.sheepIds.length);
        uint256[] memory sheepEarnings = new uint256[](pending.sheepIds.length);

        // === EFFECTS (all state changes before external calls) ===

        // Process wolves - calculate owed and update state
        for (uint256 i = 0; i < pending.wolfIds.length; i++) {
            _removeFromStakedList(owner, pending.wolfIds[i]);
            totalOwed += pending.wolfOwed[i];
        }

        // Process sheep - calculate outcomes and update state
        for (uint256 i = 0; i < pending.sheepIds.length; i++) {
            uint256 tokenId = pending.sheepIds[i];
            uint256 owed = pending.sheepOwed[i];

            // Derive unique random for this sheep
            uint256 sheepSeed = uint256(keccak256(abi.encodePacked(seed, i)));

            // Configurable steal chance: survives if random >= stealChance
            bool survives = (sheepSeed % 100) >= sheepStealChance;
            sheepSurvived[i] = survives;

            // Remove from owner's staked list (regardless of survival)
            _removeFromStakedList(owner, tokenId);

            // Remove from barn BEFORE any transfers
            delete barn[tokenId];
            totalSheepStaked--;

            if (survives) {
                // Sheep survives - pay tax and return to owner
                _payWolfTax(owed * woolClaimTaxPercentage / 100);
                uint256 ownerEarnings = owed * (100 - woolClaimTaxPercentage) / 100;
                totalOwed += ownerEarnings;
                sheepRecipients[i] = owner;
                sheepEarnings[i] = ownerEarnings;
            } else {
                // Sheep is eaten - all WOOL to wolves
                _payWolfTax(owed);

                // Determine recipient (wolf owner or return to owner)
                address wolfOwner = randomWolfOwner(sheepSeed);
                if (wolfOwner != address(0) && wolfOwner != owner) {
                    sheepRecipients[i] = wolfOwner;
                } else {
                    // No wolves or only owner's wolves - return to owner
                    sheepRecipients[i] = owner;
                }
                sheepEarnings[i] = 0;
            }
        }

        // === INTERACTIONS (all external calls after state changes) ===

        // Transfer wolves back to owner
        for (uint256 i = 0; i < pending.wolfIds.length; i++) {
            _transferFromSelf(owner, pending.wolfIds[i]);
        }

        // Transfer sheep to their recipients and emit events
        for (uint256 i = 0; i < pending.sheepIds.length; i++) {
            _transferFromSelf(sheepRecipients[i], pending.sheepIds[i]);
            emit SheepClaimed(pending.sheepIds[i], sheepEarnings[i], true, !sheepSurvived[i]);
            // Emit SheepStolen if sheep was eaten and transferred to a wolf owner
            if (!sheepSurvived[i] && sheepRecipients[i] != owner) {
                emit SheepStolen(pending.sheepIds[i], owner, sheepRecipients[i]);
            }
        }

        // Mint total owed WOOL
        if (totalOwed > 0) {
            wool.mint(owner, totalOwed);
        }
    }

    // ============================================
    // WOLF TAX DISTRIBUTION
    // ============================================

    /**
     * @notice Distribute WOOL tax to wolf pool
     * @param amount Amount of WOOL to distribute
     *
     * HOW IT WORKS:
     * - woolPerAlpha is an accumulator
     * - When tax comes in, woolPerAlpha += (tax / totalAlpha)
     * - Each wolf's earnings = alpha * (current woolPerAlpha - woolPerAlpha when staked)
     *
     * Example:
     * - Wolf A (alpha 8) stakes when woolPerAlpha = 0
     * - 100 WOOL tax comes in, totalAlpha = 10
     * - woolPerAlpha = 0 + (100/10) = 10
     * - Wolf A's earnings = 8 * (10 - 0) = 80 WOOL
     */
    function _payWolfTax(uint256 amount) internal {
        if (totalAlphaStaked == 0) {
            // No wolves staked - save for later
            unaccountedRewards += amount;
            return;
        }

        // Include any previously unaccounted rewards
        woolPerAlpha += (amount + unaccountedRewards) / totalAlphaStaked;
        unaccountedRewards = 0;
    }

    // ============================================
    // EARNINGS TRACKING
    // ============================================

    /**
     * @notice Update global earnings counter
     * @dev Called before any operation that affects earnings
     *
     * WHY TRACK GLOBALLY? To enforce the 2.4B WOOL cap.
     * Once totalWoolEarned hits MAXIMUM_GLOBAL_WOOL, sheep stop earning.
     *
     * SECURITY FIX (HIGH-1): Restructured to prevent overflow by dividing before multiplying
     * Original: (time * sheep * rate) / 1 days - could overflow with large values
     * Fixed: (time * rate / 1 days) * sheep - divides early to prevent overflow
     */
    function _updateEarnings() internal {
        if (totalWoolEarned < MAXIMUM_GLOBAL_WOOL) {
            uint256 timeDelta = block.timestamp - lastClaimTimestamp;
            // Divide early to prevent overflow: (time * rate / 1 days) * sheep
            // This ensures we don't overflow even with large time gaps
            uint256 earningsPerSheep = timeDelta * dailyWoolRate / 1 days;
            totalWoolEarned += earningsPerSheep * totalSheepStaked;
            lastClaimTimestamp = block.timestamp;
        }
    }

    // ============================================
    // RANDOM WOLF SELECTION (for stealing)
    // ============================================

    /**
     * @notice Select a random wolf owner (for steal mechanic)
     * @param seed Random seed
     * @return Owner address of selected wolf
     *
     * WEIGHTED BY ALPHA:
     * - Higher alpha wolves are more likely to be selected
     * - If totalAlphaStaked = 20 (one alpha-8 and three alpha-4 wolves)
     * - Alpha-8 wolf has 8/20 = 40% chance
     * - Each alpha-4 wolf has 4/20 = 20% chance
     */
    function randomWolfOwner(uint256 seed) public view override returns (address) {
        if (totalAlphaStaked == 0) return address(0);

        // Pick a random point in total alpha range
        uint256 bucket = (seed & 0xFFFFFFFF) % totalAlphaStaked;
        uint256 cumulative = 0;
        seed >>= 32;

        // Walk through alpha buckets (5, 6, 7, 8)
        // SECURITY FIX (HIGH-5): Track fallback in case loop doesn't find a match
        address fallbackOwner = address(0);
        for (uint8 alpha = MAX_ALPHA - 3; alpha <= MAX_ALPHA; alpha++) {
            cumulative += pack[alpha].length * alpha;
            if (pack[alpha].length > 0) {
                // Track first wolf found as fallback
                if (fallbackOwner == address(0)) {
                    fallbackOwner = pack[alpha][seed % pack[alpha].length].owner;
                }
                if (bucket < cumulative) {
                    // Found the bucket - pick random wolf from it
                    return pack[alpha][seed % pack[alpha].length].owner;
                }
            }
        }

        // SECURITY FIX (HIGH-5): Return fallback if loop didn't match (edge case)
        return fallbackOwner;
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Check if a token is a sheep
     */
    function _isSheep(uint256 tokenId) internal view returns (bool) {
        return woolf.getTokenTraits(tokenId).isSheep;
    }

    /**
     * @notice Get alpha score for a wolf
     * @dev Alpha index 0 = strongest (alpha 8), index 3 = weakest (alpha 5)
     */
    function _alphaForWolf(uint256 tokenId) internal view returns (uint8) {
        IWoolf.SheepWolf memory traits = woolf.getTokenTraits(tokenId);
        return MAX_ALPHA - traits.alphaIndex;
    }

    /**
     * @notice Get owner of a token (via Woolf contract)
     */
    function _ownerOf(uint256 tokenId) internal view returns (address) {
        (bool success, bytes memory data) = address(woolf).staticcall(
            abi.encodeWithSignature("ownerOf(uint256)", tokenId)
        );
        require(success, "ownerOf failed");
        return abi.decode(data, (address));
    }

    /**
     * @notice Transfer token to this contract
     * @dev SECURITY FIX (MED-6): Check return data and verify transfer succeeded
     */
    function _transferToSelf(address from, uint256 tokenId) internal {
        (bool success, bytes memory data) = address(woolf).call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, address(this), tokenId)
        );
        // Call must succeed and return empty data (ERC721 standard) or true (some implementations)
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Transfer failed");
    }

    /**
     * @notice Transfer token from this contract
     * @dev SECURITY FIX (MED-6): Check return data and verify transfer succeeded
     */
    function _transferFromSelf(address to, uint256 tokenId) internal {
        (bool success, bytes memory data) = address(woolf).call(
            abi.encodeWithSignature("safeTransferFrom(address,address,uint256)", address(this), to, tokenId)
        );
        // Call must succeed and return empty data (ERC721 standard) or true (some implementations)
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Transfer failed");
    }

    /**
     * @notice Remove a token from owner's staked list using swap-and-pop
     * @param owner The owner of the token
     * @param tokenId The token to remove
     */
    function _removeFromStakedList(address owner, uint256 tokenId) internal {
        uint256 index = stakedTokenIndex[tokenId];
        uint256 lastIndex = stakedTokensByOwner[owner].length - 1;

        if (index != lastIndex) {
            uint16 lastTokenId = stakedTokensByOwner[owner][lastIndex];
            stakedTokensByOwner[owner][index] = lastTokenId;
            stakedTokenIndex[lastTokenId] = index;
        }

        stakedTokensByOwner[owner].pop();
        delete stakedTokenIndex[tokenId];
    }

    /**
     * @notice Get all staked tokens for an owner
     * @param owner The address to query
     * @return Array of token IDs staked by this owner
     */
    function getStakedTokens(address owner) external view returns (uint16[] memory) {
        return stakedTokensByOwner[owner];
    }

    /**
     * @notice Get count of staked tokens for an owner
     * @param owner The address to query
     * @return Number of tokens staked by this owner
     */
    function getStakedTokenCount(address owner) external view returns (uint256) {
        return stakedTokensByOwner[owner].length;
    }

    /**
     * @notice Calculate pending WOOL for a token
     */
    function pendingWool(uint256 tokenId) external view returns (uint256) {
        if (_isSheep(tokenId)) {
            Stake memory stake = barn[tokenId];
            if (stake.owner == address(0)) return 0;

            uint256 owed;
            if (totalWoolEarned < MAXIMUM_GLOBAL_WOOL) {
                owed = (block.timestamp - stake.value) * dailyWoolRate / 1 days;
            } else if (stake.value > lastClaimTimestamp) {
                owed = 0;
            } else {
                owed = (lastClaimTimestamp - stake.value) * dailyWoolRate / 1 days;
            }
            return owed * (100 - woolClaimTaxPercentage) / 100;
        } else {
            uint256 alpha = _alphaForWolf(tokenId);
            Stake memory stake = pack[alpha][packIndices[tokenId]];
            return alpha * (woolPerAlpha - stake.value);
        }
    }

    // ============================================
    // EMERGENCY RESCUE
    // ============================================

    /**
     * @notice Emergency unstake with full WOOL rewards (no taxes)
     * @dev Only available when rescueEnabled = true
     */
    function rescue(uint256[] calldata tokenIds) external nonReentrant {
        require(rescueEnabled, "Rescue disabled");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            if (_isSheep(tokenId)) {
                Stake memory stake = barn[tokenId];
                require(stake.owner == msg.sender, "Not your sheep");

                // Calculate owed WOOL (no tax)
                uint256 owed = (block.timestamp - stake.value) * dailyWoolRate / 1 days;

                _removeFromStakedList(msg.sender, tokenId);
                delete barn[tokenId];
                totalSheepStaked--;

                // Mint WOOL if any owed
                if (owed > 0) {
                    wool.mint(msg.sender, owed);
                }

                _transferFromSelf(msg.sender, tokenId);
                emit SheepClaimed(tokenId, owed, true, false);
            } else {
                uint256 alpha = _alphaForWolf(tokenId);
                Stake memory stake = pack[alpha][packIndices[tokenId]];
                require(stake.owner == msg.sender, "Not your wolf");

                // Calculate owed WOOL
                uint256 owed = alpha * (woolPerAlpha - stake.value);

                _removeFromStakedList(msg.sender, tokenId);
                totalAlphaStaked -= alpha;

                // SECURITY FIX: Same as HIGH-4 - handle self-swap case
                uint256 lastIndex = pack[alpha].length - 1;
                uint256 currentIndex = packIndices[tokenId];

                if (currentIndex != lastIndex) {
                    Stake memory lastStake = pack[alpha][lastIndex];
                    pack[alpha][currentIndex] = lastStake;
                    packIndices[lastStake.tokenId] = currentIndex;
                }

                pack[alpha].pop();
                delete packIndices[tokenId];

                // Mint WOOL if any owed
                if (owed > 0) {
                    wool.mint(msg.sender, owed);
                }

                _transferFromSelf(msg.sender, tokenId);
                emit WolfClaimed(tokenId, owed, true);
            }
        }
    }

    /**
     * @notice Rescue stuck VRF request after timeout
     * @param requestId The VRF request ID to rescue
     * @dev SECURITY FIX (CRIT-2): Allows users to recover tokens if VRF callback fails
     *      Can only be called after RESCUE_DELAY (1 hour) has passed
     */
    function rescuePendingUnstake(uint256 requestId) external nonReentrant {
        PendingUnstake storage pending = pendingUnstakes[requestId];
        require(pending.owner == msg.sender, "Not your request");
        require(!pending.fulfilled, "Already fulfilled");
        require(block.timestamp > requestTimestamp[requestId] + RESCUE_DELAY, "Too soon");

        pending.fulfilled = true;

        // Return sheep without rewards (they're still in barn mapping)
        for (uint256 i = 0; i < pending.sheepIds.length; i++) {
            uint256 tokenId = pending.sheepIds[i];
            _removeFromStakedList(msg.sender, tokenId);
            delete barn[tokenId];
            totalSheepStaked--;
            _transferFromSelf(msg.sender, tokenId);
            emit SheepClaimed(tokenId, 0, true, false);
        }

        // Return wolves without rewards (they were already removed from pack in unstakeMany)
        for (uint256 i = 0; i < pending.wolfIds.length; i++) {
            _transferFromSelf(msg.sender, pending.wolfIds[i]);
            emit WolfClaimed(pending.wolfIds[i], 0, true);
        }

        emit PendingUnstakeRescued(requestId, msg.sender);
    }

    // ============================================
    // ADMIN
    // ============================================

    function setRescueEnabled(bool _enabled) external onlyOwner {
        rescueEnabled = _enabled;
        emit RescueEnabledChanged(_enabled);
    }

    function setPaused(bool _paused) external onlyOwner {
        if (_paused) _pause();
        else _unpause();
    }

    /// @notice Set the daily WOOL earning rate for sheep
    /// @param _rate New rate in wei (e.g., 10000 ether = 10000 WOOL/day)
    function setDailyWoolRate(uint256 _rate) external onlyOwner {
        emit DailyWoolRateChanged(dailyWoolRate, _rate);
        dailyWoolRate = _rate;
    }

    /// @notice Set minimum time before sheep can be unstaked
    /// @param _time Time in seconds (e.g., 2 days = 172800)
    function setMinimumToExit(uint256 _time) external onlyOwner {
        emit MinimumToExitChanged(minimumToExit, _time);
        minimumToExit = _time;
    }

    /// @notice Set the wolf tax percentage on sheep claims
    /// @param _percentage Tax percentage (0-100)
    function setWoolClaimTaxPercentage(uint256 _percentage) external onlyOwner {
        require(_percentage <= 100, "Invalid percentage");
        emit WoolClaimTaxPercentageChanged(woolClaimTaxPercentage, _percentage);
        woolClaimTaxPercentage = _percentage;
    }

    /// @notice Set the chance of sheep being stolen when unstaking
    /// @param _chance Steal chance percentage (0-100), 0 = never stolen, 100 = always stolen
    function setSheepStealChance(uint256 _chance) external onlyOwner {
        require(_chance <= 100, "Invalid percentage");
        emit SheepStealChanceChanged(sheepStealChance, _chance);
        sheepStealChance = _chance;
    }

    /// @notice Set the VRF subscription ID
    /// @param _subscriptionId New VRF subscription ID
    function setSubscriptionId(uint256 _subscriptionId) external onlyOwner {
        s_subscriptionId = _subscriptionId;
    }

    // ============================================
    // ERC721 RECEIVER
    // ============================================

    /**
     * @notice Handle incoming NFT transfers
     * @dev Only accepts tokens from Woolf contract during mint+stake
     */
    function onERC721Received(
        address,
        address from,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        require(from == address(0), "Cannot send directly");
        return IERC721Receiver.onERC721Received.selector;
    }
}
