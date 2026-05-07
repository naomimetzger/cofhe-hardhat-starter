import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "@cofhe/hardhat-plugin";
import * as dotenv from "dotenv";
import "./tasks";

dotenv.config({ path: `${__dirname}/.env`, override: true });

const rawPrivateKey = (process.env.PRIVATE_KEY ?? "")
  .trim()
  .replace(/^['"]|['"]$/g, "");
const privateKey = rawPrivateKey
  ? rawPrivateKey.startsWith("0x")
    ? rawPrivateKey
    : `0x${rawPrivateKey}`
  : undefined;

const config: HardhatUserConfig = {
  cofhe: {
    logMocks: true,
    gasWarning: true,
  },
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
    },
  },
  defaultNetwork: "hardhat",
  // defaultNetwork: 'localcofhe',
  networks: {
    // localcofhe, eth-sepolia, and arb-sepolia are auto-injected by @cofhe/hardhat-plugin

    // Base Sepolia testnet configuration (not provided by plugin)
    "base-sepolia": {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: privateKey ? [privateKey] : [],
      chainId: 84532,
      gasMultiplier: 1.2,
      timeout: 60000,
      httpHeaders: {},
    },
  },

  etherscan: {
    apiKey: {
      "eth-sepolia": process.env.ETHERSCAN_API_KEY || "",
      "arb-sepolia": process.env.ARBISCAN_API_KEY || "",
      "base-sepolia": process.env.BASESCAN_API_KEY || "",
    },
  },
};

export default config;
