/**
 * Extract Wolf Game Trait Data from Ethereum Mainnet
 *
 * This script reads all trait data (names + base64 PNGs) from the original
 * Wolf Game Traits contract and saves it to a JSON file.
 *
 * Usage:
 *   node script/ExtractTraits.js
 *
 * Requirements:
 *   npm install ethers
 *
 * The output file (traits-data.json) can then be used to upload
 * traits to our Base deployment.
 */

const { ethers } = require('ethers');
const fs = require('fs');

// Original Wolf Game Traits contract on Ethereum mainnet
const TRAITS_ADDRESS = '0xae05b31e679a3b352d8493c09dcce739da5b2070';

// ABI for the traitData function
const TRAITS_ABI = [
    'function traitData(uint8 traitType, uint8 traitId) view returns (string name, string png)'
];

// Public RPC endpoint (you can replace with Alchemy/Infura for better reliability)
const RPC_URL = process.env.ETH_RPC_URL || 'https://eth.llamarpc.com';

// Trait type names for reference
const TRAIT_TYPES = {
    // Sheep traits (0-8)
    0: 'Sheep Fur',
    1: 'Sheep Head',
    2: 'Sheep Ears',
    3: 'Sheep Eyes',
    4: 'Sheep Nose',
    5: 'Sheep Mouth',
    6: 'Sheep Neck',
    7: 'Sheep Feet',
    8: 'Sheep Alpha',
    // Wolf traits (9-17)
    9: 'Wolf Fur',
    10: 'Wolf Head',
    11: 'Wolf Ears',
    12: 'Wolf Eyes',
    13: 'Wolf Nose',
    14: 'Wolf Mouth',
    15: 'Wolf Neck',
    16: 'Wolf Feet',
    17: 'Wolf Alpha'
};

async function extractTraits() {
    console.log('Connecting to Ethereum mainnet...');
    console.log(`RPC: ${RPC_URL}`);
    console.log(`Contract: ${TRAITS_ADDRESS}\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(TRAITS_ADDRESS, TRAITS_ABI, provider);

    const allTraits = {};
    let totalTraits = 0;

    // Iterate through all trait types (0-17)
    for (let traitType = 0; traitType < 18; traitType++) {
        const typeName = TRAIT_TYPES[traitType];
        console.log(`\nExtracting ${typeName} (type ${traitType})...`);

        allTraits[traitType] = {
            typeName: typeName,
            traits: {}
        };

        // Try trait IDs 0-50 (most types have fewer, but this covers all)
        let consecutiveEmpty = 0;

        for (let traitId = 0; traitId < 50; traitId++) {
            try {
                const [name, png] = await contract.traitData(traitType, traitId);

                if (png && png.length > 0) {
                    allTraits[traitType].traits[traitId] = {
                        name: name,
                        png: png
                    };
                    totalTraits++;
                    consecutiveEmpty = 0;

                    // Show progress (truncate PNG for display)
                    const pngPreview = png.substring(0, 30) + '...';
                    console.log(`  [${traitId}] ${name} (${png.length} chars)`);
                } else {
                    consecutiveEmpty++;
                }

                // If we've seen 5 empty traits in a row, move to next type
                if (consecutiveEmpty >= 5) {
                    break;
                }

                // Small delay to avoid rate limiting
                await sleep(100);

            } catch (error) {
                console.error(`  Error reading trait ${traitType}/${traitId}: ${error.message}`);
                consecutiveEmpty++;
                if (consecutiveEmpty >= 5) break;
            }
        }
    }

    // Save to file
    const outputPath = 'script/traits-data.json';
    fs.writeFileSync(outputPath, JSON.stringify(allTraits, null, 2));

    console.log(`\n========================================`);
    console.log(`Extraction complete!`);
    console.log(`Total traits extracted: ${totalTraits}`);
    console.log(`Output saved to: ${outputPath}`);
    console.log(`========================================`);

    // Print summary
    console.log('\nSummary by type:');
    for (let traitType = 0; traitType < 18; traitType++) {
        const count = Object.keys(allTraits[traitType].traits).length;
        if (count > 0) {
            console.log(`  ${TRAIT_TYPES[traitType]}: ${count} traits`);
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the extraction
extractTraits().catch(console.error);
