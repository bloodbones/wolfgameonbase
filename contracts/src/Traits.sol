// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/ITraits.sol";
import "./interfaces/IWoolf.sol";

/**
 * @title Traits - On-chain SVG Generation for Wolf Game
 * @notice Generates tokenURI with metadata and SVG image for Wolf Game NFTs
 * @dev All metadata and images are generated and stored 100% on-chain.
 *      No IPFS. No API. Just the blockchain.
 *
 * HOW TRAIT STORAGE WORKS:
 * - traitData[traitType][traitId] = { name, base64PNG }
 * - Trait types 0-8: Sheep traits (Fur, Head, Ears, Eyes, Nose, Mouth, Neck, Feet, Alpha)
 * - Trait types 9-17: Wolf traits (same structure, different art)
 *
 * HOW SVG GENERATION WORKS:
 * - Each trait is a 32x32 pixel PNG, base64 encoded
 * - drawSVG() layers multiple <image> elements to compose the full character
 * - Sheep use traits 0-7, Wolves use traits 9-15 (with shift)
 *
 * UPLOADING TRAITS:
 * - Owner calls uploadTraits() with trait type, IDs, and Trait structs
 * - Each Trait has a name (e.g., "Brown Fur") and png (base64 encoded image data)
 */
contract Traits is Ownable, ITraits {
    using Strings for uint256;

    // ============================================
    // DATA STRUCTURES
    // ============================================

    /// @notice Struct to store each trait's data for metadata and rendering
    struct Trait {
        string name;
        string png;  // base64 encoded PNG data
    }

    /// @notice Mapping from trait type (index) to its name
    string[9] private _traitTypes = [
        "Fur",
        "Head",
        "Ears",
        "Eyes",
        "Nose",
        "Mouth",
        "Neck",
        "Feet",
        "Alpha"
    ];

    /// @notice Storage of each trait's name and base64 PNG data
    /// @dev traitData[traitType][traitId] = Trait
    ///      Sheep: types 0-8, Wolves: types 9-17
    mapping(uint8 => mapping(uint8 => Trait)) public traitData;

    /// @notice Mapping from alphaIndex to its score string
    string[4] private _alphas = ["8", "7", "6", "5"];

    /// @notice Reference to the Woolf NFT contract
    IWoolf public woolf;

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor() Ownable(msg.sender) {}

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /**
     * @notice Set the Woolf contract reference
     * @param _woolf Address of the Woolf NFT contract
     */
    function setWoolf(address _woolf) external onlyOwner {
        woolf = IWoolf(_woolf);
    }

    /**
     * @notice Upload trait names and images
     * @param traitType The trait type to upload (0-17)
     * @param traitIds Array of trait IDs within this type
     * @param traits Array of Trait structs with name and base64 PNG
     *
     * TRAIT TYPES:
     * Sheep: 0=Fur, 1=Head, 2=Ears, 3=Eyes, 4=Nose, 5=Mouth, 6=Neck, 7=Feet, 8=Alpha
     * Wolves: 9=Fur, 10=Head, 11=Ears, 12=Eyes, 13=Nose, 14=Mouth, 15=Neck, 16=Feet, 17=Alpha
     */
    function uploadTraits(
        uint8 traitType,
        uint8[] calldata traitIds,
        Trait[] calldata traits
    ) external onlyOwner {
        require(traitIds.length == traits.length, "Mismatched inputs");
        for (uint256 i = 0; i < traits.length; i++) {
            traitData[traitType][traitIds[i]] = Trait(
                traits[i].name,
                traits[i].png
            );
        }
    }

    // ============================================
    // RENDER FUNCTIONS
    // ============================================

    /**
     * @notice Generate an <image> element using base64 encoded PNG
     * @param trait The trait storing the PNG data
     * @return The <image> SVG element
     */
    function drawTrait(Trait memory trait) internal pure returns (string memory) {
        if (bytes(trait.png).length == 0) return "";
        return string(abi.encodePacked(
            '<image x="4" y="4" width="32" height="32" image-rendering="pixelated" preserveAspectRatio="xMidYMid" xlink:href="data:image/png;base64,',
            trait.png,
            '"/>'
        ));
    }

    /**
     * @notice Generate an entire SVG by composing multiple <image> elements
     * @param tokenId The ID of the token to generate an SVG for
     * @return A valid SVG of the Sheep / Wolf
     *
     * LAYER ORDER:
     * 1. Fur (base layer)
     * 2. Head (or alphaIndex for wolves)
     * 3. Ears (sheep only)
     * 4. Eyes
     * 5. Nose (sheep only)
     * 6. Mouth
     * 7. Neck (wolves only)
     * 8. Feet (sheep only)
     */
    function drawSVG(uint256 tokenId) public view returns (string memory) {
        IWoolf.SheepWolf memory s = woolf.getTokenTraits(tokenId);
        uint8 shift = s.isSheep ? 0 : 9;

        string memory svgString = string(abi.encodePacked(
            drawTrait(traitData[0 + shift][s.fur]),
            s.isSheep ? drawTrait(traitData[1 + shift][s.head]) : drawTrait(traitData[1 + shift][s.alphaIndex]),
            s.isSheep ? drawTrait(traitData[2 + shift][s.ears]) : '',
            drawTrait(traitData[3 + shift][s.eyes]),
            s.isSheep ? drawTrait(traitData[4 + shift][s.nose]) : '',
            drawTrait(traitData[5 + shift][s.mouth]),
            s.isSheep ? '' : drawTrait(traitData[6 + shift][s.neck]),
            s.isSheep ? drawTrait(traitData[7 + shift][s.feet]) : ''
        ));

        return string(abi.encodePacked(
            '<svg id="woolf" width="100%" height="100%" version="1.1" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
            svgString,
            '</svg>'
        ));
    }

    // ============================================
    // METADATA FUNCTIONS
    // ============================================

    /**
     * @notice Generate an attribute for the ERC721 metadata standard
     * @param traitType The trait type name
     * @param value The trait value
     * @return A JSON dictionary for the single attribute
     */
    function attributeForTypeAndValue(
        string memory traitType,
        string memory value
    ) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '{"trait_type":"',
            traitType,
            '","value":"',
            value,
            '"}'
        ));
    }

    /**
     * @notice Generate the attributes array for token metadata
     * @param tokenId The ID of the token
     * @return A JSON array of all attributes
     */
    function compileAttributes(uint256 tokenId) public view returns (string memory) {
        IWoolf.SheepWolf memory s = woolf.getTokenTraits(tokenId);
        string memory traits;

        if (s.isSheep) {
            traits = string(abi.encodePacked(
                attributeForTypeAndValue(_traitTypes[0], traitData[0][s.fur].name), ',',
                attributeForTypeAndValue(_traitTypes[1], traitData[1][s.head].name), ',',
                attributeForTypeAndValue(_traitTypes[2], traitData[2][s.ears].name), ',',
                attributeForTypeAndValue(_traitTypes[3], traitData[3][s.eyes].name), ',',
                attributeForTypeAndValue(_traitTypes[4], traitData[4][s.nose].name), ',',
                attributeForTypeAndValue(_traitTypes[5], traitData[5][s.mouth].name), ',',
                attributeForTypeAndValue(_traitTypes[7], traitData[7][s.feet].name), ','
            ));
        } else {
            traits = string(abi.encodePacked(
                attributeForTypeAndValue(_traitTypes[0], traitData[9][s.fur].name), ',',
                attributeForTypeAndValue(_traitTypes[1], traitData[10][s.alphaIndex].name), ',',
                attributeForTypeAndValue(_traitTypes[3], traitData[12][s.eyes].name), ',',
                attributeForTypeAndValue(_traitTypes[5], traitData[14][s.mouth].name), ',',
                attributeForTypeAndValue(_traitTypes[6], traitData[15][s.neck].name), ',',
                attributeForTypeAndValue("Alpha Score", _alphas[s.alphaIndex]), ','
            ));
        }

        return string(abi.encodePacked(
            '[',
            traits,
            '{"trait_type":"Generation","value":',
            tokenId <= woolf.getPaidTokens() ? '"Gen 0"' : '"Gen 1"',
            '},{"trait_type":"Type","value":',
            s.isSheep ? '"Sheep"' : '"Wolf"',
            '}]'
        ));
    }

    /**
     * @notice Generate base64 encoded metadata for a token
     * @param tokenId The ID of the token
     * @return A base64 encoded JSON data URI
     *
     * METADATA STRUCTURE:
     * {
     *   "name": "Sheep #1" or "Wolf #1",
     *   "description": "...",
     *   "image": "data:image/svg+xml;base64,...",
     *   "attributes": [...]
     * }
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        IWoolf.SheepWolf memory s = woolf.getTokenTraits(tokenId);

        string memory metadata = string(abi.encodePacked(
            '{"name": "',
            s.isSheep ? 'Sheep #' : 'Wolf #',
            tokenId.toString(),
            '", "description": "Thousands of Sheep and Wolves compete on a farm in the metaverse. A tempting prize of $WOOL awaits, with deadly high stakes. All the metadata and images are generated and stored 100% on-chain. No IPFS. NO API. Just the Ethereum blockchain.", "image": "data:image/svg+xml;base64,',
            base64(bytes(drawSVG(tokenId))),
            '", "attributes":',
            compileAttributes(tokenId),
            '}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            base64(bytes(metadata))
        ));
    }

    // ============================================
    // BASE64 ENCODING (by Brech Devos)
    // ============================================

    string internal constant TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    function base64(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return '';

        // Load the table into memory
        string memory table = TABLE;

        // Multiply by 4/3 rounded up
        uint256 encodedLen = 4 * ((data.length + 2) / 3);

        // Add some extra buffer at the end required for the writing
        string memory result = new string(encodedLen + 32);

        assembly {
            // Set the actual output length
            mstore(result, encodedLen)

            // Prepare the lookup table
            let tablePtr := add(table, 1)

            // Input ptr
            let dataPtr := data
            let endPtr := add(dataPtr, mload(data))

            // Result ptr, jump over length
            let resultPtr := add(result, 32)

            // Run over the input, 3 bytes at a time
            for {} lt(dataPtr, endPtr) {}
            {
                dataPtr := add(dataPtr, 3)

                // Read 3 bytes
                let input := mload(dataPtr)

                // Write 4 characters
                mstore(resultPtr, shl(248, mload(add(tablePtr, and(shr(18, input), 0x3F)))))
                resultPtr := add(resultPtr, 1)
                mstore(resultPtr, shl(248, mload(add(tablePtr, and(shr(12, input), 0x3F)))))
                resultPtr := add(resultPtr, 1)
                mstore(resultPtr, shl(248, mload(add(tablePtr, and(shr( 6, input), 0x3F)))))
                resultPtr := add(resultPtr, 1)
                mstore(resultPtr, shl(248, mload(add(tablePtr, and(        input,  0x3F)))))
                resultPtr := add(resultPtr, 1)
            }

            // Padding with '='
            switch mod(mload(data), 3)
            case 1 { mstore(sub(resultPtr, 2), shl(240, 0x3d3d)) }
            case 2 { mstore(sub(resultPtr, 1), shl(248, 0x3d)) }
        }

        return result;
    }
}
