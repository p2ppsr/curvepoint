import { Wallet } from '@bsv/sdk';
import {SymmetricKey} from '@bsv/sdk';
import { Utils } from '@bsv/sdk';
import {WalletProtocol} from '@bsv/sdk';


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
            // Generate a random symmetric key
            const symmetricKey = SymmetricKey.fromRandom();

            // Encrypt the message
            const encryptedMessage = symmetricKey.encrypt(message);

            // Build the CurvePoint header
            const writer = new Utils.Writer();

            for (const counterparty of counterparties) {
                // Encrypt the symmetric key for each counterparty
                const { publicKey } = await this.wallet.getPublicKey({
                    protocolID,
                    keyID,
                    counterparty,
                });

                const encryptedKey = symmetricKey.encrypt(Array.from(Buffer.from(publicKey))); // Ensure publicKey is processed as an array

                writer.writeVarIntNum(counterparty.length);
                writer.write(Array.from(Buffer.from(counterparty)));
                writer.writeVarIntNum(encryptedKey.length);
                writer.write(encryptedKey as number[]);
            }

            const header = writer.toArray();
            return {
                encryptedMessage: encryptedMessage as number[],
                header,
            };
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
            // Parse the header
            const { header, message } = this.parseHeader(ciphertext);

            // Get your identity
            const { publicKey } = await this.wallet.getPublicKey({ identityKey: true });

            // Find yourself in the header
            const reader = new Utils.Reader(header);
            let symmetricKey: SymmetricKey | null = null;

            while (!reader.eof()) {
                const counterpartyLengthArray = reader.readVarInt();
                const counterpartyLength = Array.isArray(counterpartyLengthArray)
                    ? counterpartyLengthArray[0]
                    : counterpartyLengthArray;

                if (typeof counterpartyLength !== 'number') {
                    throw new Error('Invalid counterparty length');
                }

                const counterparty = reader.read(counterpartyLength)?.toString() ?? '';

                const keyLengthArray = reader.readVarInt();
                const keyLength = Array.isArray(keyLengthArray) ? keyLengthArray[0] : keyLengthArray;

                if (typeof keyLength !== 'number') {
                    throw new Error('Invalid key length');
                }

                const encryptedKey = reader.read(keyLength);

                if (counterparty === publicKey && encryptedKey) {
                    symmetricKey = new SymmetricKey(encryptedKey); // Directly initialize SymmetricKey
                    break;
                }
            }

            if (!symmetricKey) {
                throw new Error("Your key is not found in the header.");
            }

            // Decrypt the message
            return symmetricKey.decrypt(message) as number[];
        } catch (error) {
            throw new Error(`Decryption failed: ${(error as Error).message}`);
        }
    }

    buildHeader(counterparties: string[], encryptedKeys: number[][]): number[] {
        const writer = new Utils.Writer();
        for (let i = 0; i < counterparties.length; i++) {
            const counterparty = counterparties[i];
            const encryptedKey = encryptedKeys[i];

            // Validate and process the counterparty
            if (typeof counterparty === 'string') {
                const counterpartyBuf = Array.from(Buffer.from(counterparty));

                // Write the length of the counterparty string as a VarInt
                writer.writeVarIntNum(counterpartyBuf.length);
                writer.write(counterpartyBuf); // Write the counterparty data
            } else {
                throw new Error(`Invalid counterparty format at index ${i}. Expected a string.`);
            }

            // Validate and process the encryptedKey
            if (Array.isArray(encryptedKey)) {
                writer.writeVarIntNum(encryptedKey.length);
                writer.write(encryptedKey);
            } else {
                throw new Error(`Invalid encryptedKey format at index ${i}. Expected an array.`);
            }
        }
        // Return the complete array representation
        return writer.toArray();
    }

    parseHeader(ciphertext: number[]): { header: number[]; message: number[] } {
        const reader = new Utils.Reader(ciphertext);

        const headerLengthArr = reader.readVarInt();
        const headerLength = headerLengthArr?.[0] ?? 0;
        const header = reader.read(headerLength) ?? [];
        const message = reader.bin.slice(reader.pos);

        if (!header.length || !message.length) {
            throw new Error('Failed to parse header or message.');
        }

        return { header, message };
    }
}



