// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract TimeCapsule {
    struct Capsule {
        string name;
        address[] members;
        uint8 threshold;
        uint256 unlockDate;
        bool unlocked;
        uint8 signatures;
    }

    uint256 public nextCapsuleId;

    mapping(uint256 => Capsule) public capsules;
    mapping(uint256 => mapping(address => bool)) public isMember;
    mapping(uint256 => mapping(address => bool)) public signedUnlock;
    mapping(uint256 => mapping(address => euint64)) public encryptedMessages;
    mapping(uint256 => mapping(address => bool)) public hasSubmittedMessage;

    function createCapsule(
        string memory name,
        address[] memory members,
        uint8 threshold,
        uint256 unlockDate
    ) external {
        require(members.length > 0, "No members");
        require(threshold > 0 && threshold <= members.length, "Invalid threshold");

        uint256 id = nextCapsuleId;
        nextCapsuleId++;

        Capsule storage cap = capsules[id];
        cap.name = name;
        cap.threshold = threshold;
        cap.unlockDate = unlockDate;

        for (uint256 i = 0; i < members.length; i++) {
            address member = members[i];
            require(member != address(0), "Zero member");
            require(!isMember[id][member], "Duplicate member");

            isMember[id][member] = true;
            cap.members.push(member);
        }
    }

    function submitMessage(uint256 id, InEuint64 calldata encryptedMsg) external {
        require(isMember[id][msg.sender], "Not a member");

        euint64 msgValue = FHE.asEuint64(encryptedMsg);
        encryptedMessages[id][msg.sender] = msgValue;
        hasSubmittedMessage[id][msg.sender] = true;

        FHE.allowThis(msgValue);
    }

    function signUnlock(uint256 id) external {
        Capsule storage cap = capsules[id];
        require(isMember[id][msg.sender], "Not a member");
        require(block.timestamp >= cap.unlockDate, "Too early");
        require(!cap.unlocked, "Already unlocked");
        require(!signedUnlock[id][msg.sender], "Already signed");

        signedUnlock[id][msg.sender] = true;
        cap.signatures++;

        if (cap.signatures >= cap.threshold) {
            cap.unlocked = true;

            for (uint256 i = 0; i < cap.members.length; i++) {
                address member = cap.members[i];
                if (hasSubmittedMessage[id][member]) {
                    FHE.allowPublic(encryptedMessages[id][member]);
                }
            }
        }
    }

    function revealMessage(uint256 id, address member, uint64 decrypted, bytes calldata signature) external {
        Capsule storage cap = capsules[id];
        require(cap.unlocked, "Not unlocked");
        require(isMember[id][member], "Unknown member");
        require(hasSubmittedMessage[id][member], "No message");

        FHE.publishDecryptResult(encryptedMessages[id][member], decrypted, signature);
    }

    function getRevealedMessage(uint256 id, address member) external view returns (uint64) {
        require(isMember[id][member], "Unknown member");
        require(hasSubmittedMessage[id][member], "No message");

        (uint256 value, bool decrypted) = FHE.getDecryptResultSafe(encryptedMessages[id][member]);
        require(decrypted, "Message not revealed");

        return uint64(value);
    }
}
