const hre = require("hardhat");

async function main() {
  const signers = await hre.ethers.getSigners();
  if (!signers.length) {
    throw new Error(
      "No deployer signer found for this network. Check PRIVATE_KEY in .env and network config."
    );
  }
  const deployer = signers[0];
  console.log("Deploying TimeCapsule with:", deployer.address);

  const TimeCapsule = await hre.ethers.getContractFactory("TimeCapsule", deployer);
  const timeCapsule = await TimeCapsule.deploy();
  await timeCapsule.waitForDeployment();

  const address = await timeCapsule.getAddress();
  console.log("TimeCapsule deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
