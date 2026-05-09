import { Encryptable } from "@cofhe/sdk";
import { getChainById } from "@cofhe/sdk/chains";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/web";
import { baseSepolia } from "wagmi/chains";
import type { PublicClient, WalletClient } from "viem";

let sdkClient: Awaited<ReturnType<typeof createCofheClient>> | undefined;

async function getClient(publicClient: PublicClient, walletClient: WalletClient) {
  if (sdkClient) return sdkClient;

  const chain = getChainById(baseSepolia.id);
  if (!chain) {
    throw new Error("Base Sepolia chain config not found in @cofhe/sdk.");
  }

  const config = createCofheConfig({
    environment: "web",
    supportedChains: [chain],
  });

  sdkClient = createCofheClient(config);
  // @cofhe/sdk bundles its own viem types; wagmi's clients are compatible at runtime.
  await sdkClient.connect(publicClient as never, walletClient as never);
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
