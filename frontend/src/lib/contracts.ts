export const TIME_CAPSULE_ADDRESS = "0x6046fdBAa67816d726BF6ED52816DCfc62BD41F4" as const;

export const timeCapsuleAbi = [
  {
    type: "function",
    name: "createCapsule",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "members", type: "address[]" },
      { name: "threshold", type: "uint8" },
      { name: "unlockDate", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "submitMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      {
        name: "encryptedMsg",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "securityZone", type: "uint8" },
          { name: "utype", type: "uint8" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "signUnlock",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "revealMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "member", type: "address" },
      { name: "decrypted", type: "uint64" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getRevealedMessage",
    stateMutability: "view",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "member", type: "address" },
    ],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "nextCapsuleId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "capsules",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "threshold", type: "uint8" },
      { name: "unlockDate", type: "uint256" },
      { name: "unlocked", type: "bool" },
      { name: "signatures", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "encryptedMessages",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;
