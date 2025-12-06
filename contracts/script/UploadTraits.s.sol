// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/Traits.sol";

/**
 * @title Upload Traits Script
 * @notice Uploads trait data to the Traits contract
 * @dev There are two ways to upload traits:
 *
 * OPTION 1: Use the shell script (recommended for production)
 *   1. Run: node script/GenerateUploadCalldata.js
 *   2. Edit script/upload-commands.sh with your TRAITS_ADDRESS
 *   3. Run: PRIVATE_KEY=0x... bash script/upload-commands.sh
 *
 * OPTION 2: Use this Forge script (for testing/local deployment)
 *   forge script script/UploadTraits.s.sol --rpc-url <RPC> --broadcast
 *
 * This Forge script uploads sample traits for testing. For full trait data,
 * use the shell script approach as Solidity can't efficiently read JSON.
 */
contract UploadTraits is Script {
    // Sample base64 PNG (1x1 transparent pixel)
    string constant SAMPLE_PNG =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    // Real trait: Sheep Fur - Survivor
    string constant SURVIVOR_FUR =
        "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgBAMAAACBVGfHAAAAG1BMVEUAAAAAAADfvqf////U1NSgoKDaPDayjXMTERC+6f+SAAAAAXRSTlMAQObYZgAAARFJREFUKM9dzjGOwjAQBVDnBh6I19smDXX0Az2agT5SfIAIyb3TpKVbjr1jJwGJr2n89GdkU0KWqCKzpyJcgRpkt3eNHgCDu1VqAZSYe3SlIMJgZBTYUhhZCzo9oytwEz4DOoxr2XCjBMaZcQSswjUFNZ2u6RWcHE5uSEHHt0fdcUOb0uFEOmlu9Krzi5/bkpOf685UAw0bNAPlG2N4A3DXFbl94PKYFOQNlxgz8BumH5pMNaLbwVYmH/2A0SjINzD8ClSgCsJaKTc3UKGSaNedMDL38sifsHtFWDjGXZzKLdxjzlpRcSFOWqCnKUKUiDzR76xQZEnL0y/2r91hbl5P39rXawM/N9pqrdlDRPlQgX8Br1cKW3BhdQAAAABJRU5ErkJggg==";

    function run() external {
        // Get deployed Traits contract address from environment
        address traitsAddress = vm.envAddress("TRAITS_ADDRESS");
        Traits traits = Traits(traitsAddress);

        vm.startBroadcast();

        // Upload sample sheep traits for testing
        _uploadSampleSheepTraits(traits);

        // Upload sample wolf traits for testing
        _uploadSampleWolfTraits(traits);

        vm.stopBroadcast();

        console.log("Sample traits uploaded successfully!");
        console.log("For full trait upload, use: bash script/upload-commands.sh");
    }

    function _uploadSampleSheepTraits(Traits traits) internal {
        // Sheep Fur (Type 0)
        {
            uint8[] memory ids = new uint8[](4);
            ids[0] = 0;
            ids[1] = 1;
            ids[2] = 2;
            ids[3] = 3;

            Traits.Trait[] memory data = new Traits.Trait[](4);
            data[0] = Traits.Trait("Survivor", SURVIVOR_FUR);
            data[1] = Traits.Trait("Black", SAMPLE_PNG);
            data[2] = Traits.Trait("Brown", SAMPLE_PNG);
            data[3] = Traits.Trait("Gray", SAMPLE_PNG);

            traits.uploadTraits(0, ids, data);
            console.log("Uploaded Sheep Fur traits");
        }

        // Sheep Head (Type 1)
        {
            uint8[] memory ids = new uint8[](1);
            ids[0] = 0;

            Traits.Trait[] memory data = new Traits.Trait[](1);
            data[0] = Traits.Trait("None", SAMPLE_PNG);

            traits.uploadTraits(1, ids, data);
            console.log("Uploaded Sheep Head traits");
        }

        // Sheep Ears (Type 2)
        {
            uint8[] memory ids = new uint8[](1);
            ids[0] = 0;

            Traits.Trait[] memory data = new Traits.Trait[](1);
            data[0] = Traits.Trait("None", SAMPLE_PNG);

            traits.uploadTraits(2, ids, data);
            console.log("Uploaded Sheep Ears traits");
        }

        // Sheep Eyes (Type 3)
        {
            uint8[] memory ids = new uint8[](1);
            ids[0] = 0;

            Traits.Trait[] memory data = new Traits.Trait[](1);
            data[0] = Traits.Trait("Normal", SAMPLE_PNG);

            traits.uploadTraits(3, ids, data);
            console.log("Uploaded Sheep Eyes traits");
        }

        // Sheep Nose (Type 4)
        {
            uint8[] memory ids = new uint8[](1);
            ids[0] = 0;

            Traits.Trait[] memory data = new Traits.Trait[](1);
            data[0] = Traits.Trait("Normal", SAMPLE_PNG);

            traits.uploadTraits(4, ids, data);
            console.log("Uploaded Sheep Nose traits");
        }

        // Sheep Mouth (Type 5)
        {
            uint8[] memory ids = new uint8[](1);
            ids[0] = 0;

            Traits.Trait[] memory data = new Traits.Trait[](1);
            data[0] = Traits.Trait("Normal", SAMPLE_PNG);

            traits.uploadTraits(5, ids, data);
            console.log("Uploaded Sheep Mouth traits");
        }

        // Sheep Feet (Type 7)
        {
            uint8[] memory ids = new uint8[](1);
            ids[0] = 0;

            Traits.Trait[] memory data = new Traits.Trait[](1);
            data[0] = Traits.Trait("Normal", SAMPLE_PNG);

            traits.uploadTraits(7, ids, data);
            console.log("Uploaded Sheep Feet traits");
        }
    }

    function _uploadSampleWolfTraits(Traits traits) internal {
        // Wolf Fur (Type 9)
        {
            uint8[] memory ids = new uint8[](1);
            ids[0] = 0;

            Traits.Trait[] memory data = new Traits.Trait[](1);
            data[0] = Traits.Trait("Gray", SAMPLE_PNG);

            traits.uploadTraits(9, ids, data);
            console.log("Uploaded Wolf Fur traits");
        }

        // Wolf Head (Type 10) - uses alphaIndex
        {
            uint8[] memory ids = new uint8[](4);
            ids[0] = 0;
            ids[1] = 1;
            ids[2] = 2;
            ids[3] = 3;

            Traits.Trait[] memory data = new Traits.Trait[](4);
            data[0] = Traits.Trait("Alpha 8", SAMPLE_PNG);
            data[1] = Traits.Trait("Alpha 7", SAMPLE_PNG);
            data[2] = Traits.Trait("Alpha 6", SAMPLE_PNG);
            data[3] = Traits.Trait("Alpha 5", SAMPLE_PNG);

            traits.uploadTraits(10, ids, data);
            console.log("Uploaded Wolf Head traits");
        }

        // Wolf Eyes (Type 12)
        {
            uint8[] memory ids = new uint8[](1);
            ids[0] = 0;

            Traits.Trait[] memory data = new Traits.Trait[](1);
            data[0] = Traits.Trait("Normal", SAMPLE_PNG);

            traits.uploadTraits(12, ids, data);
            console.log("Uploaded Wolf Eyes traits");
        }

        // Wolf Mouth (Type 14)
        {
            uint8[] memory ids = new uint8[](1);
            ids[0] = 0;

            Traits.Trait[] memory data = new Traits.Trait[](1);
            data[0] = Traits.Trait("Normal", SAMPLE_PNG);

            traits.uploadTraits(14, ids, data);
            console.log("Uploaded Wolf Mouth traits");
        }

        // Wolf Neck (Type 15)
        {
            uint8[] memory ids = new uint8[](1);
            ids[0] = 0;

            Traits.Trait[] memory data = new Traits.Trait[](1);
            data[0] = Traits.Trait("Normal", SAMPLE_PNG);

            traits.uploadTraits(15, ids, data);
            console.log("Uploaded Wolf Neck traits");
        }
    }
}
