import { Wallet } from '@bsv/sdk';
import { SymmetricKey } from '@bsv/sdk';
import { Utils } from '@bsv/sdk';
import { WalletProtocol } from '@bsv/sdk';
import * as fs from 'fs';

export class CurvePoint {
    private wallet: Wallet;

    constructor(wallet: Wallet) {
        this.wallet = wallet;
    }

    async encrypt(
        message: number[],
        protocolID: WalletProtocol,
        keyID: string,
        counterparties: string[]
    ): Promise<{ encryptedMessage: number[]; header: number[] }> {
        try {
            // Generate a symmetric key
            const symmetricKey = SymmetricKey.fromRandom();

            // Encrypt the message with the symmetric key
            const encryptedMessage = symmetricKey.encrypt(message);

            // Encrypt the symmetric key for each counterparty
            const encryptedKeys = await Promise.all(
                counterparties.map(async (counterparty) => {
                    const encryptedKey = await this.wallet.encrypt({
                        protocolID,
                        keyID,
                        counterparty,
                        plaintext: symmetricKey.toArray(),
                    });
                    return encryptedKey.ciphertext as number[];
                })
            );

            // Build the header
            const header = this.buildHeader(counterparties, encryptedKeys);

            return { encryptedMessage: encryptedMessage as number[], header };
        } catch (error) {
            throw new Error(`Encryption failed: ${(error as Error).message}`);
        }
    }

    async decrypt(
        ciphertext: number[],
        protocolID: WalletProtocol,
        keyID: string
    ): Promise<number[]> {
        try {
            const { header, message } = this.parseHeader(ciphertext);

            const { publicKey } = await this.wallet.getPublicKey({ identityKey: true });

            const reader = new Utils.Reader(header);
            let symmetricKey: SymmetricKey | null = null;

            while (!reader.eof()) {
                const counterpartyLength = reader.readVarIntNum();
                const counterpartyBytes = reader.read(counterpartyLength);
                const counterparty = Buffer.from(counterpartyBytes).toString('hex');

                const keyLength = reader.readVarIntNum();
                const encryptedKey = reader.read(keyLength);

                if (counterparty === publicKey) {
                    try {
                        const decryptedResults = await this.wallet.decrypt({
                            protocolID,
                            keyID,
                            ciphertext: encryptedKey,
                        });
                        symmetricKey = new SymmetricKey(decryptedResults.plaintext);
                        break;
                    } catch (error) {
                        throw error;
                    }
                }
            }

            if (!symmetricKey) {
                throw new Error('Your key is not found in the header.');
            }

            const decryptedMessage = symmetricKey.decrypt(message) as number[];
            return decryptedMessage;
        } catch (error) {
            throw new Error(`Decryption failed: ${(error as Error).message}`);
        }
    }

    buildHeader(counterparties: string[], encryptedKeys: number[][]): number[] {
        const writer = new Utils.Writer();
        for (let i = 0; i < counterparties.length; i++) {
            const counterpartyBytes = Array.from(Buffer.from(counterparties[i], 'hex'));

            writer.writeVarIntNum(counterpartyBytes.length);
            writer.write(counterpartyBytes);

            writer.writeVarIntNum(encryptedKeys[i].length);
            writer.write(encryptedKeys[i]);
        }

        const header = writer.toArray();
        return [header.length, ...header];
    }

    parseHeader(ciphertext: number[]): { header: number[]; message: number[] } {
        const reader = new Utils.Reader(ciphertext);

        const headerLength = reader.readVarIntNum();
        const header = reader.read(headerLength);
        const message = reader.bin.slice(reader.pos);

        if (header.length !== headerLength) {
            throw new Error('Failed to parse header or message.');
        }

        return { header, message };
    }
}
