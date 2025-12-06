// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "../src/Traits.sol";

/**
 * @title Upload All Traits Script
 * @notice Uploads all trait data from traits-data.json to the Traits contract
 * @dev Run with:
 *   forge script script/UploadAllTraits.s.sol --rpc-url https://sepolia.base.org --broadcast
 */
contract UploadAllTraits is Script {
    using stdJson for string;

    address constant TRAITS_ADDRESS = 0x6CB7Ac725369023079b89beb753e1afe05C9bced;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/script/traits-data.json");
        string memory json = vm.readFile(path);

        vm.startBroadcast(deployerPrivateKey);
        Traits traits = Traits(TRAITS_ADDRESS);

        // Type 0: Sheep Fur - IDs [0,1,2,3,4]
        _uploadType(traits, json, 0, _toArray5([0,1,2,3,4]));

        // Type 1: Sheep Head - IDs [0-19] (all 20)
        _uploadType(traits, json, 1, _toArray20([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19]));

        // Type 2: Sheep Ears - IDs [0,1,2,3,4,5]
        _uploadType(traits, json, 2, _toArray6([0,1,2,3,4,5]));

        // Type 3: Sheep Eyes - IDs [0-27] (all 28)
        _uploadType(traits, json, 3, _toArray28([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27]));

        // Type 4: Sheep Nose - IDs [0,1,2,3,4,5,6,7,8,9]
        _uploadType(traits, json, 4, _toArray10([0,1,2,3,4,5,6,7,8,9]));

        // Type 5: Sheep Mouth - IDs [0-15] (all 16)
        _uploadType(traits, json, 5, _toArray16([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]));

        // Type 7: Sheep Feet - IDs [0-18] (all 19)
        _uploadType(traits, json, 7, _toArray19([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]));

        // Type 9: Wolf Fur - IDs [0,1,2,3,4,5,6,7,8]
        _uploadType(traits, json, 9, _toArray9([0,1,2,3,4,5,6,7,8]));

        // Type 10: Wolf Head - IDs [0,1,2,3]
        _uploadType(traits, json, 10, _toArray4([0,1,2,3]));

        // Type 12: Wolf Eyes - IDs [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26]
        _uploadType(traits, json, 12, _toArray27([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26]));

        // Type 14: Wolf Mouth - IDs [0,1,2,3,4,5,6,7,8,9,10,11,12]
        _uploadType(traits, json, 14, _toArray13([0,1,2,3,4,5,6,7,8,9,10,11,12]));

        // Type 15: Wolf Neck - IDs [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14]
        _uploadType(traits, json, 15, _toArray15([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14]));

        vm.stopBroadcast();
        console.log("All traits uploaded successfully!");
    }

    function _uploadType(Traits traits, string memory json, uint8 traitType, uint8[] memory traitIds) internal {
        uint256 len = traitIds.length;
        Traits.Trait[] memory data = new Traits.Trait[](len);

        for (uint256 i = 0; i < len; i++) {
            string memory nameKey = string.concat(".", vm.toString(traitType), ".traits.", vm.toString(traitIds[i]), ".name");
            string memory pngKey = string.concat(".", vm.toString(traitType), ".traits.", vm.toString(traitIds[i]), ".png");
            data[i] = Traits.Trait(
                json.readString(nameKey),
                json.readString(pngKey)
            );
        }

        traits.uploadTraits(traitType, traitIds, data);
        console.log("Uploaded type %d: %d traits", traitType, len);
    }

    // Helper functions to convert fixed arrays to dynamic
    function _toArray4(uint8[4] memory arr) internal pure returns (uint8[] memory) {
        uint8[] memory result = new uint8[](4);
        for (uint i = 0; i < 4; i++) result[i] = arr[i];
        return result;
    }

    function _toArray5(uint8[5] memory arr) internal pure returns (uint8[] memory) {
        uint8[] memory result = new uint8[](5);
        for (uint i = 0; i < 5; i++) result[i] = arr[i];
        return result;
    }

    function _toArray6(uint8[6] memory arr) internal pure returns (uint8[] memory) {
        uint8[] memory result = new uint8[](6);
        for (uint i = 0; i < 6; i++) result[i] = arr[i];
        return result;
    }

    function _toArray9(uint8[9] memory arr) internal pure returns (uint8[] memory) {
        uint8[] memory result = new uint8[](9);
        for (uint i = 0; i < 9; i++) result[i] = arr[i];
        return result;
    }

    function _toArray10(uint8[10] memory arr) internal pure returns (uint8[] memory) {
        uint8[] memory result = new uint8[](10);
        for (uint i = 0; i < 10; i++) result[i] = arr[i];
        return result;
    }

    function _toArray13(uint8[13] memory arr) internal pure returns (uint8[] memory) {
        uint8[] memory result = new uint8[](13);
        for (uint i = 0; i < 13; i++) result[i] = arr[i];
        return result;
    }

    function _toArray15(uint8[15] memory arr) internal pure returns (uint8[] memory) {
        uint8[] memory result = new uint8[](15);
        for (uint i = 0; i < 15; i++) result[i] = arr[i];
        return result;
    }

    function _toArray16(uint8[16] memory arr) internal pure returns (uint8[] memory) {
        uint8[] memory result = new uint8[](16);
        for (uint i = 0; i < 16; i++) result[i] = arr[i];
        return result;
    }

    function _toArray19(uint8[19] memory arr) internal pure returns (uint8[] memory) {
        uint8[] memory result = new uint8[](19);
        for (uint i = 0; i < 19; i++) result[i] = arr[i];
        return result;
    }

    function _toArray20(uint8[20] memory arr) internal pure returns (uint8[] memory) {
        uint8[] memory result = new uint8[](20);
        for (uint i = 0; i < 20; i++) result[i] = arr[i];
        return result;
    }

    function _toArray27(uint8[27] memory arr) internal pure returns (uint8[] memory) {
        uint8[] memory result = new uint8[](27);
        for (uint i = 0; i < 27; i++) result[i] = arr[i];
        return result;
    }

    function _toArray28(uint8[28] memory arr) internal pure returns (uint8[] memory) {
        uint8[] memory result = new uint8[](28);
        for (uint i = 0; i < 28; i++) result[i] = arr[i];
        return result;
    }
}
