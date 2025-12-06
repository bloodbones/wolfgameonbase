// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/Traits.sol";

/**
 * @title Upload Missing Traits Script
 * @notice Uploads missing trait data discovered by comparing with mainnet
 * @dev Run with:
 *   forge script script/UploadMissingTraits.s.sol --rpc-url https://sepolia.base.org --broadcast
 *
 * Missing traits identified:
 * - Type 0 (Sheep Fur) ID 4: White
 * - Type 1 (Sheep Head) ID 14: Red Cap
 * - Type 3 (Sheep Eyes) IDs 0,1,3,5,25: Angry, Basic Sun Protection, Bloodshot, Cross Eyed, Squint Left
 * - Type 5 (Sheep Mouth) ID 11: Pipe
 * - Type 7 (Sheep Feet) ID 5: Frozen
 */
contract UploadMissingTraits is Script {
    address constant TRAITS_ADDRESS = 0x6CB7Ac725369023079b89beb753e1afe05C9bced;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        Traits traits = Traits(TRAITS_ADDRESS);

        // Type 0: Sheep Fur - ID 4 (White)
        {
            uint8[] memory ids = new uint8[](1);
            ids[0] = 4;
            Traits.Trait[] memory data = new Traits.Trait[](1);
            data[0] = Traits.Trait(
                "White",
                "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgBAMAAACBVGfHAAAAGFBMVEUAAAD///8AAADfvqfU1NSgoKCyjXMTERDoC1piAAAAAXRSTlMAQObYZgAAARNJREFUKM9VkbGKwzAQRE3+YIzSyxtL19uQfs2a6430AzK4TnX5/RvLTi43DAI9Zge0aqrEi1ykeekimIAe4s97DwdAoe1BegOIVB3aGjBTKHZo8DWQlAHaKdoKZtMrQCumOhGSZcVV0QGeYCqZjG4HRxDsdg9LyXQcO86EZSzldhe6rANbQ9ziOlbd49q3zWWR5QTDIntHym8AKEds/gDYgb2BOxL6kTCWJrR/wLH0P2gJDPEA3dGR9IwMoNiRTSG7OnUKT7ATU+XhTLmykBPXaXCOlBurEVMujSe+GyqQzHSac/J17ST0xFfK4/w5KSJR5GslqGQr2yNu/md8gXV4PuLon88TxHVgamTjKRHZiyr4BfrNU9BDNuzNAAAAAElFTkSuQmCC"
            );
            traits.uploadTraits(0, ids, data);
            console.log("Uploaded Type 0 (Fur) ID 4: White");
        }

        // Type 1: Sheep Head - ID 14 (Red Cap)
        {
            uint8[] memory ids = new uint8[](1);
            ids[0] = 14;
            Traits.Trait[] memory data = new Traits.Trait[](1);
            data[0] = Traits.Trait(
                "Red Cap",
                "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgBAMAAACBVGfHAAAAElBMVEUAAACxHRgAAACGIickUpkwY9MrfZpjAAAAAXRSTlMAQObYZgAAADtJREFUKM9jAAElCFBggAImY2VBQUEhQSGYgLKRoSAQKAoqUEuASUkJVUDFBQhcQ4EArgIBFBhGwcAAAGyiDXTUrjeJAAAAAElFTkSuQmCC"
            );
            traits.uploadTraits(1, ids, data);
            console.log("Uploaded Type 1 (Head) ID 14: Red Cap");
        }

        // Type 3: Sheep Eyes - IDs 0,1,3,5,25
        {
            uint8[] memory ids = new uint8[](5);
            ids[0] = 0;
            ids[1] = 1;
            ids[2] = 3;
            ids[3] = 5;
            ids[4] = 25;

            Traits.Trait[] memory data = new Traits.Trait[](5);
            data[0] = Traits.Trait(
                "Angry",
                "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgAQMAAABJtOi3AAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABRJREFUCNdjIBcIOAAJjgYkLk0AAG9gASkMl47GAAAAAElFTkSuQmCC"
            );
            data[1] = Traits.Trait(
                "Basic Sun Protection",
                "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgAgMAAAAOFJJnAAAACVBMVEUAAAAAAAD///+D3c/SAAAAAXRSTlMAQObYZgAAACJJREFUGNNjoAdgDAUCMCsyIDIAzAgLCIMwRB1EHRgGLwAAHzIEnvQWWWQAAAAASUVORK5CYII="
            );
            data[2] = Traits.Trait(
                "Bloodshot",
                "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgAgMAAAAOFJJnAAAADFBMVEUAAACxHRgAAAD////ZxzMJAAAAAXRSTlMAQObYZgAAABtJREFUGNNjoC/QYlgBYYg3xEEYog1hDIMYAADBZgKzhJLdVwAAAABJRU5ErkJggg=="
            );
            data[3] = Traits.Trait(
                "Cross Eyed",
                "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgAgMAAAAOFJJnAAAACVBMVEUAAAD///8AAABzxoNxAAAAAXRSTlMAQObYZgAAABpJREFUGNNjoAtgaliAJsLoEABlNExgGMQAANhaAsVGXr3gAAAAAElFTkSuQmCC"
            );
            data[4] = Traits.Trait(
                "Squint Left",
                "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgAgMAAAAOFJJnAAAACVBMVEUAAAAAAAD///+D3c/SAAAAAXRSTlMAQObYZgAAABZJREFUGNNjGCAg6hAKYag1zGIYxAAANOEB67hwr/gAAAAASUVORK5CYII="
            );
            traits.uploadTraits(3, ids, data);
            console.log("Uploaded Type 3 (Eyes) IDs 0,1,3,5,25");
        }

        // Type 5: Sheep Mouth - ID 11 (Pipe)
        {
            uint8[] memory ids = new uint8[](1);
            ids[0] = 11;
            Traits.Trait[] memory data = new Traits.Trait[](1);
            data[0] = Traits.Trait(
                "Pipe",
                "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgAgMAAAAOFJJnAAAADFBMVEUAAAAAAAB3RkyUXFnbHKunAAAAAXRSTlMAQObYZgAAACNJREFUGNNjGLxAFMbIdgyAMsKXQBhZ/6AiUiuhalhDGGgCAECZBUzRP8rtAAAAAElFTkSuQmCC"
            );
            traits.uploadTraits(5, ids, data);
            console.log("Uploaded Type 5 (Mouth) ID 11: Pipe");
        }

        // Type 7: Sheep Feet - ID 5 (Frozen)
        {
            uint8[] memory ids = new uint8[](1);
            ids[0] = 5;
            Traits.Trait[] memory data = new Traits.Trait[](1);
            data[0] = Traits.Trait(
                "Frozen",
                "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgAgMAAAAOFJJnAAAADFBMVEUAAAAAxfCf3fkAAAAF6gJPAAAAAXRSTlMAQObYZgAAACRJREFUGNNjGJnAgZGBDUSzujIGSIEY1xpMF4BlpBrYFiApBABjtARoNgJwbQAAAABJRU5ErkJggg=="
            );
            traits.uploadTraits(7, ids, data);
            console.log("Uploaded Type 7 (Feet) ID 5: Frozen");
        }

        vm.stopBroadcast();
        console.log("");
        console.log("All missing traits uploaded successfully!");
    }
}
