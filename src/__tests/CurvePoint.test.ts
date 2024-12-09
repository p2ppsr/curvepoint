import PrivateKey from '@bsv/sdk/src/primitives/PrivateKey.js';
import ProtoWallet from '@bsv/sdk/src/wallet/ProtoWallet.js';
import { CurvePoint } from '../CurvePoint.js';
import SymmetricKey from '@bsv/sdk/src/primitives/SymmetricKey.js';
import { Writer } from '@bsv/sdk/src/primitives/utils.js';
import { SecurityLevels, SecurityLevel } from '@bsv/sdk/src/wallet/Wallet.interfaces.js';

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
            const decryptedMessage = await curvePoint.decrypt(
                [...header, ...encryptedMessage],
                protocolID,
                keyID
            );
            expect(decryptedMessage).toEqual(message);
        }
    });

    test('Fail to decrypt with incorrect key', async () => {
        const protocolID: [SecurityLevel, string] = [SecurityLevels.Counterparty, 'testProtocol'];
        const curvePoint = new CurvePoint(participants[0].wallet);

        const validSymmetricKey = SymmetricKey.fromRandom();
        const encryptedMessage = validSymmetricKey.encrypt([1, 2, 3, 4]) as number[];

        const header = new Writer()
            .writeVarIntNum(participants[1].publicKey.length)
            .write(Array.from(Buffer.from(participants[1].publicKey)))
            .writeVarIntNum(validSymmetricKey.toArray().length)
            .write(validSymmetricKey.toArray())
            .toArray();

        const fakeKey = 'invalidKey';

        await expect(
            curvePoint.decrypt([...header, ...encryptedMessage], protocolID, fakeKey)
        ).rejects.toThrow("Your key is not found in the header.");
    });

    test('Encrypt and decrypt empty message', async () => {
        const curvePoint = new CurvePoint(participants[0].wallet);
        const counterparties = participants.map((p) => p.publicKey);
        const protocolID: [SecurityLevel, string] = [SecurityLevels.App, 'exampleProtocol'];
        const keyID = 'exampleKey';

        const { encryptedMessage, header } = await curvePoint.encrypt([], protocolID, keyID, counterparties);

        for (const participant of participants) {
            const decryptedMessage = await curvePoint.decrypt(
                [...header, ...encryptedMessage],
                protocolID,
                keyID
            );
            expect(decryptedMessage).toEqual([]);
        }
    });
});
