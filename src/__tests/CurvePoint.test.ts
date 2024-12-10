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
                .map(async () => {
                    const privateKey = PrivateKey.fromRandom();
                    const wallet = new ProtoWallet(privateKey);
                    const { publicKey } = await wallet.getPublicKey({ identityKey: true });
                    return { wallet, publicKey };
                })
        );
    });

    test('Encrypt and decrypt message successfully', async () => {
        const curvePoint = new CurvePoint(participants[0].wallet);
        const counterparties = participants.map((p) => p.publicKey);
        const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'exampleProtocol'];
        const keyID = 'exampleKey';

        const { encryptedMessage, header } = await curvePoint.encrypt(
            message,
            protocolID,
            keyID,
            counterparties
        );

        for (const participant of participants) {
            try {
                const decryptedMessage = await curvePoint.decrypt(
                    [...header, ...encryptedMessage],
                    protocolID,
                    keyID
                );
                expect(decryptedMessage).toEqual(message);
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
    //     const curvePoint = new CurvePoint(participants[0].wallet);
    //     const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'singleProtocol'];
    //     const keyID = 'exampleKey';

    //     const { encryptedMessage, header } = await curvePoint.encrypt(
    //         message,
    //         protocolID,
    //         keyID,
    //         [participants[1].publicKey]
    //     );

    //     try {
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
});
