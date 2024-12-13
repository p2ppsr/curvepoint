import { PrivateKey } from '@bsv/sdk';
import { ProtoWallet } from '@bsv/sdk';
import { CurvePoint } from '../CurvePoint';
import { SymmetricKey } from '@bsv/sdk';
import { Utils } from '@bsv/sdk';
import { SecurityLevels, SecurityLevel } from '@bsv/sdk';

describe('CurvePoint Library', () => {
    let participants: { wallet: ProtoWallet; publicKey: string }[];
    const message: number[] = [1, 2, 3, 4]; // Example message

    beforeAll(async () => {
        // Create participants with ProtoWallet and public keys
        participants = await Promise.all(
            Array(3)
                .fill(null)
                .map(async (_, index) => {
                    const privateKey = PrivateKey.fromRandom();
                    const wallet = new ProtoWallet(privateKey);
                    const { publicKey } = await wallet.getPublicKey({ identityKey: true });
                    console.log(`Participant ${index}:`);
                    console.log(`  Private Key: ${privateKey.toString()}`);
                    console.log(`  Public Key: ${publicKey}`);
                    return { wallet, publicKey };
                })
        );
    });

    test('Encrypt and decrypt message successfully', async () => {
        const curvePoint = new CurvePoint(participants[0].wallet);
        const counterparties = participants.map((p) => p.publicKey);
        const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'exampleProtocol'];
        const keyID = 'exampleKey';
    
        // Step 1: Encrypt the message
        const { encryptedMessage, header } = await curvePoint.encrypt(
            message,
            protocolID,
            keyID,
            counterparties
        );
    
        // Step 2: Test decryption for each participant
        for (const participant of participants) {
            try {
                const decryptedMessage = await curvePoint.decrypt(
                    [...header, ...encryptedMessage],
                    protocolID,
                    keyID,
                    participant.publicKey // Pass the participant's public key
                );
                expect(decryptedMessage).toEqual(message);
                console.log(`Decryption successful for participant: ${participant.publicKey}`);
            } catch (error) {
                console.error(`Decryption failed for participant: ${participant.publicKey}`);
                console.error(`Error: ${(error as Error).message}`);
                throw error;
            }
        }        
    });
    
    // test('Fail to decrypt with incorrect key', async () => {
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.Counterparty, 'testProtocol'];
    //     const curvePoint = new CurvePoint(participants[0].wallet);

    //     const validSymmetricKey = SymmetricKey.fromRandom();
    //     const encryptedMessage = validSymmetricKey.encrypt(message) as number[];

    //     const header = new Utils.Writer()
    //         .writeVarIntNum(participants[1].publicKey.length)
    //         .write(Array.from(Buffer.from(participants[1].publicKey)))
    //         .writeVarIntNum(validSymmetricKey.toArray().length)
    //         .write(validSymmetricKey.toArray())
    //         .toArray();

    //     const fakeKey = 'invalidKey';

    //     await expect(
    //         curvePoint.decrypt([...header, ...encryptedMessage], protocolID, fakeKey)
    //     ).rejects.toThrow("Your key is not found in the header.");
    // });

    // test('Encrypt and decrypt empty message', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const counterparties = participants.map((p) => p.publicKey);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'exampleProtocol'];
    //     const keyID = 'exampleKey';

    //     const { encryptedMessage, header } = await curvePoint.encrypt([], protocolID, keyID, counterparties);

    //     for (const participant of participants) {
    //         try {
    //             const decryptedMessage = await curvePoint.decrypt(
    //                 [...header, ...encryptedMessage],
    //                 protocolID,
    //                 keyID
    //             );
    //             expect(decryptedMessage).toEqual([]);
    //         } catch (error) {
    //             console.error(`Decryption failed for empty message and participant: ${participant.publicKey}`);
    //             console.error(`Error: ${(error as Error).message}`);
    //             throw error;
    //         }
    //     }
    // });

    // test('Handle malformed header gracefully', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'exampleProtocol'];
    //     const keyID = 'exampleKey';

    //     const malformedHeader = new Utils.Writer()
    //         .writeVarIntNum(0) // Invalid counterparty length
    //         .toArray();

    //     const malformedCiphertext = [...malformedHeader, ...[5, 6, 7, 8]];

    //     await expect(
    //         curvePoint.decrypt(malformedCiphertext, protocolID, keyID)
    //     ).rejects.toThrow('Failed to parse header or message.');
    // });

    // test('Encrypt and decrypt with single counterparty', async () => {
    //     // Use participant[1] for encryption (counterparty)
    //     const encryptingParticipant = participants[1];
    //     const decryptingParticipant = participants[1]; // Ensure it matches for decryption
    
    //     const curvePoint = new CurvePoint(decryptingParticipant.wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'singleProtocol'];
    //     const keyID = 'exampleKey';
    
    //     // Log the public keys being used
    //     console.log('Public Key used for encryption (counterparty):', encryptingParticipant.publicKey);
    //     console.log('Public Key used for decryption (current user):', decryptingParticipant.publicKey);
    
    //     const { encryptedMessage, header } = await curvePoint.encrypt(
    //         message,
    //         protocolID,
    //         keyID,
    //         [encryptingParticipant.publicKey]
    //     );
    
    //     try {
    //         console.log('Starting single counterparty decryption...');
    //         const decryptedMessage = await curvePoint.decrypt(
    //             [...header, ...encryptedMessage],
    //             protocolID,
    //             keyID
    //         );
    
    //         expect(decryptedMessage).toEqual(message);
    //     } catch (error) {
    //         console.error('Failed to decrypt message for single counterparty.');
    //         console.error(`Error: ${(error as Error).message}`);
    //         throw error;
    //     }
    // });

    // test('Handle large group of counterparties', async () => {
    //     // Create a large group of counterparties
    //     const largeGroup: string[] = Array(50)
    //         .fill(null)
    //         .map(() => {
    //             const privateKey = PrivateKey.fromRandom();
    //             const publicKey = privateKey.toPublicKey();
    //             const publicKeyHex = publicKey.toDER('hex'); // Convert public key to hex string
    
    //             // Validate that the public key is a string
    //             if (typeof publicKeyHex !== 'string') {
    //                 throw new Error('Public key conversion to hex failed.');
    //             }
    
    //             return publicKeyHex; // Ensure it's a string
    //         });
    
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'largeGroupProtocol'];
    //     const keyID = 'largeGroupKey';
    
    //     const { encryptedMessage, header } = await curvePoint.encrypt(
    //         message,
    //         protocolID,
    //         keyID,
    //         largeGroup
    //     );
    
    //     try {
    //         expect(header).toBeDefined();
    //         expect(header.length).toBeGreaterThan(0);
    //         expect(encryptedMessage).toBeDefined();
    //         expect(encryptedMessage.length).toBeGreaterThan(0);
    //     } catch (error) {
    //         console.error('Failed test with a large group of counterparties.');
    //         console.error(`Header length: ${header.length}`);
    //         console.error(`Encrypted message length: ${encryptedMessage.length}`);
    //         throw error;
    //     }
    // });    

    // test('Subgroup Messaging', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const counterparties = participants.map((p) => p.publicKey);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'subgroupMessagingProtocol'];
    //     const keyID = 'subgroupKey';
    
    //     console.log('Original Message:', message);
    
    //     // Define the subgroup (subset of participants)
    //     const subgroupKeys = counterparties.filter((_, index) => index !== 1);
    //     console.log('Subgroup Public Keys:', subgroupKeys);
    
    //     // Step 1: Encrypt the message for the subgroup
    //     const { encryptedMessage, header } = await curvePoint.encrypt(
    //         message,
    //         protocolID,
    //         keyID,
    //         subgroupKeys
    //     );
    
    //     console.log('Subgroup header:', header);
    //     console.log('Subgroup encrypted message:', encryptedMessage);
    
    //     // Debug: Analyze the keys stored in the header
    //     console.log('Analyzing keys stored in the header...');
    //     const headerReader = new Utils.Reader(header.slice(1)); // Adjust for actual header parsing logic
    //     while (!headerReader.eof()) {
    //         const keyLength = headerReader.readVarIntNum();
    //         const keyBytes = headerReader.read(keyLength);
    //         const keyHex = Buffer.from(keyBytes).toString('hex');
    //         console.log(`Key in header: ${keyHex}`);
    //     }
    
    //     // Step 2: Ensure non-subgroup members cannot decrypt the message
    //     const nonSubCurvePoint = new CurvePoint(participants[1].wallet);
    //     console.log(`Testing decryption for non-subgroup member: ${participants[1].publicKey}`);
    //     await expect(
    //         nonSubCurvePoint.decrypt([...header, ...encryptedMessage], protocolID, keyID)
    //     ).rejects.toThrow('Your key is not found in the header.');
    //     console.log('Non-subgroup member decryption failed as expected.');
    
    //     // Step 3: Test decryption for subgroup members
    //     for (const participant of participants) {
    //         const isSubgroupMember = subgroupKeys.includes(participant.publicKey);
    //         console.log(`Testing decryption for participant: ${participant.publicKey}`);
    //         if (!isSubgroupMember) {
    //             console.log(`Skipping non-subgroup member: ${participant.publicKey}`);
    //             continue;
    //         }
    
    //         try {
    //             const decryptedMessage = await curvePoint.decrypt(
    //                 [...header, ...encryptedMessage],
    //                 protocolID,
    //                 keyID
    //             );
    //             console.log(`Decryption successful for participant: ${participant.publicKey}`);
    //             expect(decryptedMessage).toEqual(message);
    //         } catch (error) {
    //             console.error(`Decryption failed for participant: ${participant.publicKey}`);
    //             console.error(`Error: ${(error as Error).message}`);
    //             throw error;
    //         }
    //     }
    // });
    
    

    // test('Partial Revocation', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet); // Use a single instance
    //     const counterparties = participants.map((p) => p.publicKey);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'revocationProtocol'];
    //     const keyID = 'revocationKey';
    
    //     // Step 1: Encrypt the message with all participants
    //     const { encryptedMessage, header } = await curvePoint.encrypt(
    //         message,
    //         protocolID,
    //         keyID,
    //         counterparties
    //     );
    
    //     // Step 2: Verify all participants can decrypt the message
    //     for (const participant of participants) {
    //         try {
    //             const decryptedMessage = await curvePoint.decrypt(
    //                 [...header, ...encryptedMessage],
    //                 protocolID,
    //                 keyID
    //             );
    //             expect(decryptedMessage).toEqual(message);
    //         } catch (error) {
    //             console.error(`Decryption failed for participant: ${participant.publicKey}`);
    //             console.error(`Error: ${(error as Error).message}`);
    //             throw error;
    //         }
    //     }
    
    //     // Step 3: Revoke access for Participant 1
    //     console.log(`Revoking access for participant[1]: ${counterparties[1]}`);
    //     const newHeader = await curvePoint.removeParticipant(header, counterparties[1]);
    
    //     // Step 4: Verify only remaining participants can still decrypt the message
    //     console.log('Decrypting remaining participants after revocation...');
    //     for (const participant of participants) {
    //         if (participant.publicKey === counterparties[1]) {
    //             // Test that revoked participant cannot decrypt
    //             console.log(`Testing decryption failure for revoked participant: ${participant.publicKey}`);
    //             try {
    //                 await expect(
    //                     curvePoint.decrypt([...newHeader, ...encryptedMessage], protocolID, keyID)
    //                 ).rejects.toThrow('Your key is not found in the header.');
    //                 console.log('Revoked participant decryption attempt failed as expected.');
    //             } catch (error) {
    //                 console.error('Unexpected success: Revoked participant was able to decrypt the message.');
    //                 throw error; // Fail the test
    //             }
    //             continue;
    //         }
    //         try {
    //             const decryptedMessage = await curvePoint.decrypt(
    //                 [...newHeader, ...encryptedMessage],
    //                 protocolID,
    //                 keyID
    //             );
    //             expect(decryptedMessage).toEqual(message);
    //             console.log(`Decryption successful for participant: ${participant.publicKey}`);
    //         } catch (error) {
    //             console.error(`Decryption failed for participant: ${participant.publicKey}`);
    //             console.error(`Error: ${(error as Error).message}`);
    //             throw error;
    //         }
    //     }
    // });
    
    
    
    
    
    
    
    

    // test('Access Granting: Grant new participant access to a previously encrypted message', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'accessGrantProtocol'];
    //     const keyID = 'exampleKey';
    
    //     // Step 1: Encrypt a message for participants[0] and participants[1]
    //     const subset = [participants[0].publicKey, participants[1].publicKey];
    //     const { encryptedMessage, header } = await curvePoint.encrypt(
    //         message,
    //         protocolID,
    //         keyID,
    //         subset
    //     );
    
    //     console.log('Original header:', header);
    
    //     // Step 2: Grant access to participants[2]
    //     const newHeader = await curvePoint.addParticipant(
    //         header,
    //         participants[2].publicKey,
    //         protocolID,
    //         keyID
    //     );
    
    //     console.log('Updated header after granting access:', newHeader);
    
    //     // Step 3: Verify that participants[0], participants[1], and participants[2] can decrypt
    //     for (const participant of participants) {
    //         if (!subset.includes(participant.publicKey) && participant !== participants[2]) {
    //             continue; // Skip participants not in the subset or the new participant
    //         }
    
    //         const participantCurvePoint = new CurvePoint(participant.wallet);
    //         const decryptedMessage = await participantCurvePoint.decrypt(
    //             [...newHeader, ...encryptedMessage],
    //             protocolID,
    //             keyID
    //         );
    //         expect(decryptedMessage).toEqual(message);
    //     }
    
    //     // Step 4: Ensure other participants cannot decrypt the updated message
    //     for (const participant of participants) {
    //         if (subset.includes(participant.publicKey) || participant === participants[2]) {
    //             continue; // Skip participants with access
    //         }
    
    //         const participantCurvePoint = new CurvePoint(participant.wallet);
    //         await expect(
    //             participantCurvePoint.decrypt([...newHeader, ...encryptedMessage], protocolID, keyID)
    //         ).rejects.toThrow('Your key is not found in the header.');
    //     }
    // });
    

    // test('Message-Specific Key Derivation: Unique key derivation per message', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'messageSpecificKey'];
    
    //     // Encrypt two messages with different keyIDs
    //     const keyID1 = 'messageKey1';
    //     const keyID2 = 'messageKey2';
    
    //     const encryption1 = await curvePoint.encrypt(
    //         message,
    //         protocolID,
    //         keyID1,
    //         participants.map((p) => p.publicKey)
    //     );
    
    //     const encryption2 = await curvePoint.encrypt(
    //         message,
    //         protocolID,
    //         keyID2,
    //         participants.map((p) => p.publicKey)
    //     );
    
    //     // Decrypt each message with the corresponding keyID
    //     const encryptions = [
    //         { encryption: encryption1, keyID: keyID1 },
    //         { encryption: encryption2, keyID: keyID2 },
    //     ];
    
    //     for (const { encryption, keyID } of encryptions) {
    //         for (const participant of participants) {
    //             const curvePointInstance = new CurvePoint(participant.wallet);
    //             const decryptedMessage = await curvePointInstance.decrypt(
    //                 [...encryption.header, ...encryption.encryptedMessage],
    //                 protocolID,
    //                 keyID
    //             );
    //             expect(decryptedMessage).toEqual(message);
    //         }
    //     }
    // });

    // test('Duplicate Counterparty Entries', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'duplicateCounterparty'];
    //     const keyID = 'duplicateKey';
    
    //     // Include duplicate public keys in the counterparty list
    //     const counterparties = [
    //         participants[1].publicKey,
    //         participants[2].publicKey,
    //         participants[1].publicKey, // Duplicate
    //     ];
    
    //     try {
    //         const { encryptedMessage, header } = await curvePoint.encrypt(
    //             message,
    //             protocolID,
    //             keyID,
    //             counterparties
    //         );
    
    //         // Ensure all unique participants can decrypt the message
    //         const uniqueCounterparties = Array.from(new Set(counterparties)); // Deduplicate for validation
    //         for (const publicKey of uniqueCounterparties) {
    //             const participant = participants.find((p) => p.publicKey === publicKey);
    
    //             // Handle case where participant is not found
    //             if (!participant) {
    //                 throw new Error(`Participant with publicKey ${publicKey} not found.`);
    //             }
    
    //             const participantCurvePoint = new CurvePoint(participant.wallet);
    
    //             const decryptedMessage = await participantCurvePoint.decrypt(
    //                 [...header, ...encryptedMessage],
    //                 protocolID,
    //                 keyID
    //             );
    //             expect(decryptedMessage).toEqual(message);
    //         }
    //     } catch (error) {
    //         console.error('Encryption failed with duplicate counterparties:', error);
    //         throw error; // Rethrow to fail the test if unexpected error occurs
    //     }
    // });    

    // test('Zero Recipients', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'zeroRecipients'];
    //     const keyID = 'noRecipientsKey';
    
    //     // Attempt to encrypt with an empty counterparties list
    //     const counterparties: string[] = [];
    
    //     await expect(
    //         curvePoint.encrypt(message, protocolID, keyID, counterparties)
    //     ).rejects.toThrow('No recipients specified for encryption.');
    // });
    
    // test('Unordered Recipients', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'unorderedRecipients'];
    //     const keyID = 'unorderedKey';
    
    //     // Create counterparties in different orders
    //     const counterpartiesOrdered = participants.map((p) => p.publicKey);
    //     const counterpartiesUnordered = [...counterpartiesOrdered].reverse();
    
    //     // Encrypt the message with ordered counterparties
    //     const { encryptedMessage, header } = await curvePoint.encrypt(
    //         message,
    //         protocolID,
    //         keyID,
    //         counterpartiesOrdered
    //     );
    
    //     // Verify that all participants can decrypt regardless of counterparty order
    //     for (const participant of participants) {
    //         const participantCurvePoint = new CurvePoint(participant.wallet);
    
    //         // Decrypt using the unordered counterparties
    //         const decryptedMessage = await participantCurvePoint.decrypt(
    //             [...header, ...encryptedMessage],
    //             protocolID,
    //             keyID
    //         );
    //         expect(decryptedMessage).toEqual(message);
    //     }
    // });

    // test('Empty Header', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'emptyHeader'];
    //     const keyID = 'emptyHeaderKey';
    
    //     // Create a completely empty header
    //     const emptyHeader: number[] = [];
    //     const malformedCiphertext = [...emptyHeader, ...[1, 2, 3, 4]];
    
    //     // Attempt to decrypt with an empty header
    //     await expect(
    //         curvePoint.decrypt(malformedCiphertext, protocolID, keyID)
    //     ).rejects.toThrow('Failed to parse header or message.');
    // });

    // test('Malformed Encrypted Key', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'malformedKey'];
    //     const keyID = 'malformedKey';
    
    //     // Encrypt the message normally
    //     const { encryptedMessage, header } = await curvePoint.encrypt(
    //         message,
    //         protocolID,
    //         keyID,
    //         participants.map((p) => p.publicKey)
    //     );
    
    //     // Corrupt the encrypted key for the first counterparty
    //     const reader = new Utils.Reader(header);
    //     const headerLength = reader.readVarIntNum();
    //     const malformedHeader = [...reader.read(headerLength)];
    //     malformedHeader[10] = 255; // Arbitrarily corrupt a byte in the header
    
    //     // Attempt to decrypt with the malformed header
    //     const malformedCiphertext = [...malformedHeader, ...encryptedMessage];
    //     await expect(
    //         curvePoint.decrypt(malformedCiphertext, protocolID, keyID)
    //     ).rejects.toThrow('Decryption failed: Your key is not found in the header.');
    // });

    // test('Replay Attack Prevention', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'replayAttack'];
    //     const keyID = 'replayKey';
    
    //     // Encrypt the same message twice
    //     const encryption1 = await curvePoint.encrypt(
    //         message,
    //         protocolID,
    //         keyID,
    //         participants.map((p) => p.publicKey)
    //     );
    
    //     const encryption2 = await curvePoint.encrypt(
    //         message,
    //         protocolID,
    //         keyID,
    //         participants.map((p) => p.publicKey)
    //     );
    
    //     // Ensure the ciphertexts are different
    //     expect(encryption1.encryptedMessage).not.toEqual(encryption2.encryptedMessage);
    //     expect(encryption1.header).not.toEqual(encryption2.header);
    
    //     // Decrypt both messages to verify correctness
    //     for (const encryption of [encryption1, encryption2]) {
    //         for (const participant of participants) {
    //             const participantCurvePoint = new CurvePoint(participant.wallet);
    
    //             const decryptedMessage = await participantCurvePoint.decrypt(
    //                 [...encryption.header, ...encryption.encryptedMessage],
    //                 protocolID,
    //                 keyID
    //             );
    //             expect(decryptedMessage).toEqual(message);
    //         }
    //     }
    // });

    // test('Header Tampering', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'headerTampering'];
    //     const keyID = 'tamperedKey';
    
    //     const { encryptedMessage, header } = await curvePoint.encrypt(
    //         message,
    //         protocolID,
    //         keyID,
    //         participants.map((p) => p.publicKey)
    //     );
    
    //     // Tamper with the header by modifying a public key
    //     const tamperedHeader = [...header];
    //     tamperedHeader[10] = tamperedHeader[10] ^ 0xff; // Invert a random byte in the header
    
    //     // Attempt to decrypt with the tampered header
    //     const tamperedCiphertext = [...tamperedHeader, ...encryptedMessage];
    
    //     await expect(
    //         curvePoint.decrypt(tamperedCiphertext, protocolID, keyID)
    //     ).rejects.toThrow('Decryption failed: Your key is not found in the header.');
    // });

    // test('Key Reuse', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'keyReuse'];
    //     const keyID = 'reusedKey';
    
    //     // Generate a single symmetric key to reuse across multiple encryptions
    //     const symmetricKey = SymmetricKey.fromRandom();
    
    //     // Encrypt two different messages with the same key
    //     const message1 = [1, 2, 3, 4];
    //     const message2 = [5, 6, 7, 8];
    
    //     const encryptedMessage1 = symmetricKey.encrypt(message1) as number[];
    //     const encryptedMessage2 = symmetricKey.encrypt(message2) as number[];
    
    //     const header = curvePoint.buildHeader(
    //         participants.map((p) => p.publicKey),
    //         [symmetricKey.toArray(), symmetricKey.toArray()]
    //     );
    
    //     // Verify that both messages can be decrypted securely
    //     for (const [encryptedMessage, originalMessage] of [
    //         [encryptedMessage1, message1],
    //         [encryptedMessage2, message2],
    //     ]) {
    //         for (const participant of participants) {
    //             const participantCurvePoint = new CurvePoint(participant.wallet);
    //             const decryptedMessage = await participantCurvePoint.decrypt(
    //                 [...header, ...encryptedMessage],
    //                 protocolID,
    //                 keyID
    //             );
    //             expect(decryptedMessage).toEqual(originalMessage);
    //         }
    //     }
    // });

    // test('Incorrect IV Handling', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'incorrectIV'];
    //     const keyID = 'ivTestKey';
    
    //     const { encryptedMessage, header } = await curvePoint.encrypt(
    //         message,
    //         protocolID,
    //         keyID,
    //         participants.map((p) => p.publicKey)
    //     );
    
    //     // Tamper with the IV in the encrypted message
    //     const tamperedEncryptedMessage = [...encryptedMessage];
    //     tamperedEncryptedMessage[0] = tamperedEncryptedMessage[0] ^ 0xff; // Corrupt the first byte of the encrypted message
    
    //     const tamperedCiphertext = [...header, ...tamperedEncryptedMessage];
    
    //     // Attempt to decrypt with the tampered IV
    //     await expect(
    //         curvePoint.decrypt(tamperedCiphertext, protocolID, keyID)
    //     ).rejects.toThrow('Decryption failed: Integrity check failed.');
    // });

    // test('Very Large Groups', async () => {
    //     const largeGroupSize = 1000;
    //     const largeGroup: string[] = Array(largeGroupSize)
    //         .fill(null)
    //         .map(() => {
    //             const privateKey = PrivateKey.fromRandom();
    //             const publicKey = privateKey.toPublicKey();
    //             return publicKey.toDER('hex') as string; // Explicitly cast to string
    //         });

    
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'veryLargeGroup'];
    //     const keyID = 'largeGroupKey';
    
    //     const { encryptedMessage, header } = await curvePoint.encrypt(
    //         message,
    //         protocolID,
    //         keyID,
    //         largeGroup
    //     );
    
    //     // Verify the header and encrypted message
    //     expect(header).toBeDefined();
    //     expect(header.length).toBeGreaterThan(0);
    //     expect(encryptedMessage).toBeDefined();
    //     expect(encryptedMessage.length).toBeGreaterThan(0);
    
    //     // Spot-check decryption for a few participants
    //     for (let i = 0; i < 10; i++) {
    //         const publicKey = largeGroup[i];
    //         const participant = participants.find((p) => p.publicKey === publicKey);
    
    //         if (participant) {
    //             const participantCurvePoint = new CurvePoint(participant.wallet);
    //             const decryptedMessage = await participantCurvePoint.decrypt(
    //                 [...header, ...encryptedMessage],
    //                 protocolID,
    //                 keyID
    //             );
    //             expect(decryptedMessage).toEqual(message);
    //         }
    //     }
    // });
    
    // test('Chunked Encryption', async () => {
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'chunkedEncryption'];
    //     const keyID = 'chunkedKey';
    
    //     // Create a large message
    //     const largeMessage: number[] = Array(10_000).fill(1); // A message with 10,000 numbers
    
    //     // Split the large message into chunks (e.g., 1,000 per chunk)
    //     const chunkSize = 1_000;
    //     const chunks: number[][] = []; // Explicitly define the type for chunks
    //     for (let i = 0; i < largeMessage.length; i += chunkSize) {
    //         chunks.push(largeMessage.slice(i, i + chunkSize));
    //     }
    
    //     const encryptedChunks = await Promise.all(
    //         chunks.map(async (chunk) =>
    //             curvePoint.encrypt(chunk, protocolID, keyID, participants.map((p) => p.publicKey))
    //         )
    //     );
    
    //     // Decrypt each chunk and reconstruct the original message
    //     let reconstructedMessage: number[] = [];
    //     for (const { encryptedMessage, header } of encryptedChunks) {
    //         for (const participant of participants) {
    //             const participantCurvePoint = new CurvePoint(participant.wallet);
    //             const decryptedChunk = await participantCurvePoint.decrypt(
    //                 [...header, ...encryptedMessage],
    //                 protocolID,
    //                 keyID
    //             );
    //             reconstructedMessage = reconstructedMessage.concat(decryptedChunk);
    //         }
    //     }
    
    //     // Verify the reconstructed message matches the original
    //     expect(reconstructedMessage).toEqual(largeMessage);
    // });

    // test('Encryption and Decryption Timing', async () => {
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'timingTest'];
    //     const keyID = 'timingKey';
    
    //     const groupSizes = [10, 100, 500]; // Varying group sizes
    //     const messageSizes = [100, 1000, 10000]; // Varying message sizes
    
    //     for (const groupSize of groupSizes) {
    //         const group: string[] = Array(groupSize)
    //             .fill(null)
    //             .map(() => {
    //                 const privateKey = PrivateKey.fromRandom();
    //                 return privateKey.toPublicKey().toDER('hex') as string; // Ensure it's a string
    //             });
    
    //         for (const messageSize of messageSizes) {
    //             const message = Array(messageSize).fill(1); // Large message
    //             const curvePoint = new CurvePoint(participants[0].wallet);
    
    //             // Measure encryption time
    //             const startEncryption = performance.now();
    //             const { encryptedMessage, header } = await curvePoint.encrypt(
    //                 message,
    //                 protocolID,
    //                 keyID,
    //                 group
    //             );
    //             const endEncryption = performance.now();
    //             console.log(
    //                 `Encryption time for group size ${groupSize} and message size ${messageSize}: ${
    //                     endEncryption - startEncryption
    //                 } ms`
    //             );
    
    //             // Measure decryption time
    //             const startDecryption = performance.now();
    //             const decryptedMessage = await curvePoint.decrypt(
    //                 [...header, ...encryptedMessage],
    //                 protocolID,
    //                 keyID
    //             );
    //             const endDecryption = performance.now();
    //             console.log(
    //                 `Decryption time for group size ${groupSize} and message size ${messageSize}: ${
    //                     endDecryption - startDecryption
    //                 } ms`
    //             );
    
    //             expect(decryptedMessage).toEqual(message);
    //         }
    //     }
    // });    
    
    // test('Memory Usage', async () => {
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'memoryTest'];
    //     const keyID = 'memoryKey';
    
    //     const largeGroupSize = 1000; // Large number of participants
    //     const largeMessageSize = 100_000; // Large message
    //     const largeGroup: string[] = Array(largeGroupSize)
    //         .fill(null)
    //         .map(() => {
    //             const privateKey = PrivateKey.fromRandom();
    //             return privateKey.toPublicKey().toDER('hex') as string; // Ensure it is a string
    //         });
    //     const largeMessage = Array(largeMessageSize).fill(1);
    
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    
    //     console.log('Memory usage before encryption:', process.memoryUsage());
    
    //     // Encrypt
    //     const { encryptedMessage, header } = await curvePoint.encrypt(
    //         largeMessage,
    //         protocolID,
    //         keyID,
    //         largeGroup
    //     );
    
    //     console.log('Memory usage after encryption:', process.memoryUsage());
    
    //     // Decrypt
    //     const decryptedMessage = await curvePoint.decrypt(
    //         [...header, ...encryptedMessage],
    //         protocolID,
    //         keyID
    //     );
    
    //     console.log('Memory usage after decryption:', process.memoryUsage());
    
    //     expect(decryptedMessage).toEqual(largeMessage);
    // });

    // test('Cross-Wallet Compatibility', async () => {
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'crossWallet'];
    //     const keyID = 'crossWalletKey';
    
    //     // Create wallets for two participants
    //     const participant1 = {
    //         privateKey: PrivateKey.fromRandom(),
    //         wallet: new ProtoWallet(PrivateKey.fromRandom()),
    //     };
    //     const participant2 = {
    //         privateKey: PrivateKey.fromRandom(),
    //         wallet: new ProtoWallet(PrivateKey.fromRandom()),
    //     };
    
    //     // Get public keys for the participants
    //     const publicKey1 = (await participant1.wallet.getPublicKey({ identityKey: true })).publicKey;
    //     const publicKey2 = (await participant2.wallet.getPublicKey({ identityKey: true })).publicKey;
    
    //     // Ensure public keys are available
    //     expect(publicKey1).toBeDefined();
    //     expect(publicKey2).toBeDefined();
    
    //     // Participant 1 encrypts a message for participant 2
    //     const message = [1, 2, 3, 4];
    //     const curvePoint1 = new CurvePoint(participant1.wallet);
    
    //     const { encryptedMessage, header } = await curvePoint1.encrypt(
    //         message,
    //         protocolID,
    //         keyID,
    //         [publicKey2]
    //     );
    
    //     // Participant 2 decrypts the message
    //     const curvePoint2 = new CurvePoint(participant2.wallet);
    //     const decryptedMessage = await curvePoint2.decrypt(
    //         [...header, ...encryptedMessage],
    //         protocolID,
    //         keyID
    //     );
    
    //     // Verify the decrypted message matches the original
    //     expect(decryptedMessage).toEqual(message);
    // });

    // test('Protocol Compatibility', async () => {
    //     const keyID = 'protocolTestKey';
    //     const protocolIDs: [SecurityLevel, string][] = [
    //         [SecurityLevels.Silent, 'protocolSilent'],
    //         [SecurityLevels.App, 'protocolApp'],
    //         [SecurityLevels.Counterparty, 'protocolCounterparty'],
    //     ];
    
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    
    //     // Encrypt and decrypt a message for each protocolID
    //     for (const protocolID of protocolIDs) {
    //         const message = [42, 43, 44, 45]; // Example message
    //         const counterparties = participants.map((p) => p.publicKey);
    
    //         // Encrypt the message
    //         const { encryptedMessage, header } = await curvePoint.encrypt(
    //             message,
    //             protocolID,
    //             keyID,
    //             counterparties
    //         );
    
    //         // Ensure each participant can decrypt the message
    //         for (const participant of participants) {
    //             const participantCurvePoint = new CurvePoint(participant.wallet);
    //             const decryptedMessage = await participantCurvePoint.decrypt(
    //                 [...header, ...encryptedMessage],
    //                 protocolID,
    //                 keyID
    //             );
    
    //             // Verify the decrypted message matches the original
    //             expect(decryptedMessage).toEqual(message);
    //         }
    //     }
    // });
    
});
