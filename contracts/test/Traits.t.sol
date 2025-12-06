// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Traits.sol";
import "../src/interfaces/IWoolf.sol";

/**
 * @title Traits Tests
 * @notice Tests for the on-chain SVG generation contract
 */

// Mock Woolf contract for testing Traits
contract MockWoolfForTraits {
    mapping(uint256 => IWoolf.SheepWolf) public tokenTraits;
    uint256 public paidTokens = 10000;

    function setTokenTraits(uint256 tokenId, IWoolf.SheepWolf memory traits) external {
        tokenTraits[tokenId] = traits;
    }

    function getTokenTraits(uint256 tokenId) external view returns (IWoolf.SheepWolf memory) {
        return tokenTraits[tokenId];
    }

    function getPaidTokens() external view returns (uint256) {
        return paidTokens;
    }
}

contract TraitsTest is Test {
    Traits public traits;
    MockWoolfForTraits public woolf;

    address public owner = address(0x1001);

    // Sample base64 PNG data (1x1 transparent pixel)
    string constant SAMPLE_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    // Real trait data from extraction (Sheep Fur - Survivor)
    string constant SURVIVOR_FUR = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgBAMAAACBVGfHAAAAG1BMVEUAAAAAAADfvqf////U1NSgoKDaPDayjXMTERC+6f+SAAAAAXRSTlMAQObYZgAAARFJREFUKM9dzjGOwjAQBVDnBh6I19smDXX0Az2agT5SfIAIyb3TpKVbjr1jJwGJr2n89GdkU0KWqCKzpyJcgRpkt3eNHgCDu1VqAZSYe3SlIMJgZBTYUhhZCzo9oytwEz4DOoxr2XCjBMaZcQSswjUFNZ2u6RWcHE5uSEHHt0fdcUOb0uFEOmlu9Krzi5/bkpOf685UAw0bNAPlG2N4A3DXFbl94PKYFOQNlxgz8BumH5pMNaLbwVYmH/2A0SjINzD8ClSgCsJaKTc3UKGSaNedMDL38sifsHtFWDjGXZzKLdxjzlpRcSFOWqCnKUKUiDzR76xQZEnL0y/2r91hbl5P39rXawM/N9pqrdlDRPlQgX8Br1cKW3BhdQAAAABJRU5ErkJggg==";

    function setUp() public {
        vm.startPrank(owner);

        // Deploy mock Woolf
        woolf = new MockWoolfForTraits();

        // Deploy Traits
        traits = new Traits();
        traits.setWoolf(address(woolf));

        vm.stopPrank();
    }

    // ============================================
    // DEPLOYMENT TESTS
    // ============================================

    function test_InitialState() public view {
        assertEq(address(traits.woolf()), address(woolf));
        assertEq(traits.owner(), owner);
    }

    // ============================================
    // UPLOAD TRAITS TESTS
    // ============================================

    function test_UploadTraits() public {
        vm.startPrank(owner);

        // Upload a single sheep fur trait
        uint8[] memory traitIds = new uint8[](1);
        traitIds[0] = 0;

        Traits.Trait[] memory traitData = new Traits.Trait[](1);
        traitData[0] = Traits.Trait("Survivor", SURVIVOR_FUR);

        traits.uploadTraits(0, traitIds, traitData);

        // Verify it was stored
        (string memory name, string memory png) = traits.traitData(0, 0);
        assertEq(name, "Survivor");
        assertEq(png, SURVIVOR_FUR);

        vm.stopPrank();
    }

    function test_UploadMultipleTraits() public {
        vm.startPrank(owner);

        // Upload multiple sheep fur traits
        uint8[] memory traitIds = new uint8[](3);
        traitIds[0] = 0;
        traitIds[1] = 1;
        traitIds[2] = 2;

        Traits.Trait[] memory traitData = new Traits.Trait[](3);
        traitData[0] = Traits.Trait("Survivor", SAMPLE_PNG);
        traitData[1] = Traits.Trait("Black", SAMPLE_PNG);
        traitData[2] = Traits.Trait("Brown", SAMPLE_PNG);

        traits.uploadTraits(0, traitIds, traitData);

        // Verify all were stored
        (string memory name0,) = traits.traitData(0, 0);
        (string memory name1,) = traits.traitData(0, 1);
        (string memory name2,) = traits.traitData(0, 2);

        assertEq(name0, "Survivor");
        assertEq(name1, "Black");
        assertEq(name2, "Brown");

        vm.stopPrank();
    }

    function test_OnlyOwnerCanUploadTraits() public {
        uint8[] memory traitIds = new uint8[](1);
        traitIds[0] = 0;

        Traits.Trait[] memory traitData = new Traits.Trait[](1);
        traitData[0] = Traits.Trait("Test", SAMPLE_PNG);

        // Try to upload as non-owner
        vm.prank(address(0x9999));
        vm.expectRevert();
        traits.uploadTraits(0, traitIds, traitData);
    }

    function test_UploadTraits_MismatchedInputs_Reverts() public {
        vm.startPrank(owner);

        uint8[] memory traitIds = new uint8[](2);
        traitIds[0] = 0;
        traitIds[1] = 1;

        Traits.Trait[] memory traitData = new Traits.Trait[](1);
        traitData[0] = Traits.Trait("Test", SAMPLE_PNG);

        vm.expectRevert("Mismatched inputs");
        traits.uploadTraits(0, traitIds, traitData);

        vm.stopPrank();
    }

    // ============================================
    // SVG GENERATION TESTS
    // ============================================

    function test_DrawSVG_Sheep() public {
        _uploadBasicSheepTraits();

        // Create a sheep token
        woolf.setTokenTraits(1, IWoolf.SheepWolf({
            isSheep: true,
            fur: 0,
            head: 0,
            ears: 0,
            eyes: 0,
            nose: 0,
            mouth: 0,
            neck: 0,
            feet: 0,
            alphaIndex: 0
        }));

        // Generate SVG
        string memory svg = traits.drawSVG(1);

        // Verify SVG structure
        assertTrue(bytes(svg).length > 0);
        assertTrue(_contains(svg, '<svg id="woolf"'));
        assertTrue(_contains(svg, '</svg>'));
        assertTrue(_contains(svg, 'viewBox="0 0 40 40"'));
    }

    function test_DrawSVG_Wolf() public {
        _uploadBasicWolfTraits();

        // Create a wolf token
        woolf.setTokenTraits(1, IWoolf.SheepWolf({
            isSheep: false,
            fur: 0,
            head: 0,
            ears: 0,
            eyes: 0,
            nose: 0,
            mouth: 0,
            neck: 0,
            feet: 0,
            alphaIndex: 0  // Alpha 8
        }));

        // Generate SVG
        string memory svg = traits.drawSVG(1);

        // Verify SVG structure
        assertTrue(bytes(svg).length > 0);
        assertTrue(_contains(svg, '<svg id="woolf"'));
    }

    // ============================================
    // TOKEN URI TESTS
    // ============================================

    function test_TokenURI_Sheep_Gen0() public {
        _uploadBasicSheepTraits();

        woolf.setTokenTraits(1, IWoolf.SheepWolf({
            isSheep: true,
            fur: 0,
            head: 0,
            ears: 0,
            eyes: 0,
            nose: 0,
            mouth: 0,
            neck: 0,
            feet: 0,
            alphaIndex: 0
        }));

        string memory uri = traits.tokenURI(1);

        // Should be a data URI
        assertTrue(_contains(uri, "data:application/json;base64,"));
        assertTrue(bytes(uri).length > 50);
    }

    function test_TokenURI_Wolf_Gen1() public {
        _uploadBasicWolfTraits();

        // Token 10001 is Gen 1
        woolf.setTokenTraits(10001, IWoolf.SheepWolf({
            isSheep: false,
            fur: 0,
            head: 0,
            ears: 0,
            eyes: 0,
            nose: 0,
            mouth: 0,
            neck: 0,
            feet: 0,
            alphaIndex: 2  // Alpha 6
        }));

        string memory uri = traits.tokenURI(10001);

        // Should be a data URI
        assertTrue(_contains(uri, "data:application/json;base64,"));
    }

    // ============================================
    // COMPILE ATTRIBUTES TESTS
    // ============================================

    function test_CompileAttributes_Sheep() public {
        _uploadBasicSheepTraits();

        woolf.setTokenTraits(1, IWoolf.SheepWolf({
            isSheep: true,
            fur: 0,
            head: 0,
            ears: 0,
            eyes: 0,
            nose: 0,
            mouth: 0,
            neck: 0,
            feet: 0,
            alphaIndex: 0
        }));

        string memory attrs = traits.compileAttributes(1);

        // Should contain trait types
        assertTrue(_contains(attrs, '"trait_type":"Fur"'));
        assertTrue(_contains(attrs, '"trait_type":"Type"'));
        assertTrue(_contains(attrs, '"value":"Sheep"'));
        assertTrue(_contains(attrs, '"value":"Gen 0"'));
    }

    function test_CompileAttributes_Wolf() public {
        _uploadBasicWolfTraits();

        woolf.setTokenTraits(10001, IWoolf.SheepWolf({
            isSheep: false,
            fur: 0,
            head: 0,
            ears: 0,
            eyes: 0,
            nose: 0,
            mouth: 0,
            neck: 0,
            feet: 0,
            alphaIndex: 0
        }));

        string memory attrs = traits.compileAttributes(10001);

        // Should contain wolf-specific traits
        assertTrue(_contains(attrs, '"trait_type":"Alpha Score"'));
        assertTrue(_contains(attrs, '"value":"8"'));  // alphaIndex 0 = Alpha 8
        assertTrue(_contains(attrs, '"value":"Wolf"'));
        assertTrue(_contains(attrs, '"value":"Gen 1"'));
    }

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    function _uploadBasicSheepTraits() internal {
        vm.startPrank(owner);

        // Upload minimal sheep traits for testing
        uint8[] memory ids = new uint8[](1);
        ids[0] = 0;

        Traits.Trait[] memory data = new Traits.Trait[](1);
        data[0] = Traits.Trait("Test", SAMPLE_PNG);

        // Sheep traits: 0=Fur, 1=Head, 2=Ears, 3=Eyes, 4=Nose, 5=Mouth, 7=Feet
        traits.uploadTraits(0, ids, data);  // Fur
        traits.uploadTraits(1, ids, data);  // Head
        traits.uploadTraits(2, ids, data);  // Ears
        traits.uploadTraits(3, ids, data);  // Eyes
        traits.uploadTraits(4, ids, data);  // Nose
        traits.uploadTraits(5, ids, data);  // Mouth
        traits.uploadTraits(7, ids, data);  // Feet

        vm.stopPrank();
    }

    function _uploadBasicWolfTraits() internal {
        vm.startPrank(owner);

        uint8[] memory ids = new uint8[](1);
        ids[0] = 0;

        Traits.Trait[] memory data = new Traits.Trait[](1);
        data[0] = Traits.Trait("Test", SAMPLE_PNG);

        // Wolf traits: 9=Fur, 10=Head, 12=Eyes, 14=Mouth, 15=Neck
        traits.uploadTraits(9, ids, data);   // Fur
        traits.uploadTraits(10, ids, data);  // Head (uses alphaIndex)
        traits.uploadTraits(12, ids, data);  // Eyes
        traits.uploadTraits(14, ids, data);  // Mouth
        traits.uploadTraits(15, ids, data);  // Neck

        vm.stopPrank();
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);

        if (n.length > h.length) return false;
        if (n.length == 0) return true;

        for (uint256 i = 0; i <= h.length - n.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }
}
