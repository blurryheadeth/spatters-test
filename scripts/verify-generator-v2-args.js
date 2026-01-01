// Verification arguments for SpattersGeneratorV2 on mainnet
// Usage: npx hardhat verify --network mainnet --constructor-args scripts/verify-generator-v2-args.js <CONTRACT_ADDRESS>

const fs = require('fs');
const path = require('path');

// Load deployment configs
const storageConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'deployments', 'mainnet-storage.json'), 'utf8'));
const templateConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'deployments', 'mainnet-template.json'), 'utf8'));
const spattersConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'deployments', 'mainnet.json'), 'utf8'));

// Get template addresses (support both formats)
let htmlTemplateAddresses;
if (templateConfig.templateAddresses) {
  htmlTemplateAddresses = templateConfig.templateAddresses;
} else if (templateConfig.templateAddress) {
  htmlTemplateAddresses = [templateConfig.templateAddress];
}

module.exports = [
  spattersConfig.address,                    // _spattersContract
  storageConfig.spattersAddresses,           // _storageAddresses
  htmlTemplateAddresses,                     // _htmlTemplateAddresses
  "https://spatters.art/legal/all"           // _initialTermsURL (comprehensive page with all legal docs)
];

