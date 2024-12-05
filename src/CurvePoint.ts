import { Wallet, SecurityLevel } from '@bsv/sdk/src/wallet/Wallet.interfaces.js';
import SymmetricKey from '@bsv/sdk/src/primitives/SymmetricKey.js';
import { Writer, Reader } from '@bsv/sdk/src/primitives/utils.js';

export class CurvePoint {
    private wallet: Wallet;

    constructor(wallet: Wallet) {
        this.wallet = wallet;
    }

    async encrypt(
        message: number[],
        protocolID: [SecurityLevel, string], // Use SecurityLevel here
        keyID: string,
        counterparties: string[]
    ): Promise<{ encryptedMessage: number[]; header: number[] }> {
        try {
            // Generate a random symmetric key
            const symmetricKey = SymmetricKey.fromRandom();

            // Encrypt the message
            const encryptedMessage = symmetricKey.encrypt(message);

            // Build the CurvePoint header
            const writer = new Writer();

            for (const counterparty of counterparties) {
                // Encrypt the symmetric key for each counterparty
                const { publicKey } = await this.wallet.getPublicKey({
                    protocolID,
                    keyID,
                    counterparty,
                });

                const encryptedKey = symmetricKey.encryptKey(publicKey);

                writer.writeVarInt(counterparty.length);
                writer.write(Buffer.from(counterparty));
                writer.writeVarInt(encryptedKey.length);
                writer.write(encryptedKey);
            }

            const header = writer.toArray();
            return {
                encryptedMessage,
                header,
            };
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    async decrypt(
        ciphertext: number[],
        protocolID: [number, string],
        keyID: string
    ): Promise<number[]> {
        try {
            // Parse the header
            const { header, message } = this.parseHeader(ciphertext);

            // Get your identity
            const { publicKey } = await this.wallet.getPublicKey({ identityKey: true });

            // Find yourself in the header
            const reader = new Reader(header);
            let symmetricKey: SymmetricKey | null = null;

            while (!reader.eof()) {
                const counterpartyLength = reader.readVarInt();
                const counterparty = reader.read(counterpartyLength).toString();
                const keyLength = reader.readVarInt();
                const encryptedKey = reader.read(keyLength);

                if (counterparty === publicKey) {
                    const decryptedKey = symmetricKey.decryptKey(encryptedKey, publicKey);
                    symmetricKey = SymmetricKey.fromKey(decryptedKey);
                    break;
                }
            }

            if (!symmetricKey) {
                throw new Error("Your key is not found in the header.");
            }

            // Decrypt the message
            return symmetricKey.decrypt(message);
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    buildHeader(counterparties: string[], encryptedKeys: number[][]): number[] {
        const writer = new Writer();
        for (let i = 0; i < counterparties.length; i++) {
            writer.writeVarInt(counterparties[i].length);
            writer.write(Buffer.from(counterparties[i]));
            writer.writeVarInt(encryptedKeys[i].length);
            writer.write(encryptedKeys[i]);
        }
        return writer.toArray();
    }

    parseHeader(ciphertext: number[]): { header: number[]; message: number[] } {
        const reader = new Reader(ciphertext);
        const headerLength = reader.readVarInt();
        const header = reader.read(headerLength);
        const message = reader.readRemaining();
        return { header, message };
    }
}
