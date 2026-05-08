import { Encryptable } from "@cofhe/sdk";
import { baseSepolia } from "wagmi/chains";
import type { PublicClient, WalletClient } from "viem";

let sdkClient: any;

async function getClient(publicClient: PublicClient, walletClient: WalletClient) {
  if (sdkClient) return sdkClient;

  const sdk = await import("@cofhe/sdk/web");
  const chains = await import("@cofhe/sdk/chains");

  const chain = chains.getChainById(baseSepolia.id);
  if (!chain) {
    throw new Error("Base Sepolia chain config not found in @cofhe/sdk.");
  }

  const config = sdk.createCofheConfig({
    environment: "web",
    supportedChains: [chain],
  });

  sdkClient = sdk.createCofheClient(config);
  await sdkClient.connect(publicClient, walletClient);
  return sdkClient;
}

export async function encryptUint64Input(
  value: bigint,
  publicClient: PublicClient,
  walletClient: WalletClient
) {
  const client = await getClient(publicClient, walletClient);
  const encrypted = await client.encryptInputs([Encryptable.uint64(value)]).execute();
  return encrypted[0];
}

export async function decryptCiphertextForTx(
  ciphertext: `0x${string}`,
  publicClient: PublicClient,
  walletClient: WalletClient
) {
  const client = await getClient(publicClient, walletClient);
  return client.decryptForTx(ciphertext).withoutPermit().execute();
}
