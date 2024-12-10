import { Wallet } from '@bsv/sdk';
import { SymmetricKey } from '@bsv/sdk';
import { Utils } from '@bsv/sdk';
import { WalletProtocol } from '@bsv/sdk';

export class CurvePoint {
    private wallet: Wallet;

    constructor(wallet: Wallet) {
        this.wallet = wallet;
        console.log('CurvePoint initialized with wallet:', wallet);
    }

    async encrypt(
        message: number[],
        protocolID: WalletProtocol,
        keyID: string,
        counterparties: string[]
    ): Promise<{ encryptedMessage: number[]; header: number[] }> {
        try {
            console.log('Starting encryption...');
            console.log('Message:', message);
            console.log('Protocol ID:', protocolID);
            console.log('Key ID:', keyID);
            console.log('Counterparties:', counterparties);

            const symmetricKey = SymmetricKey.fromRandom();
            console.log('Generated symmetric key:', symmetricKey.toArray());

            const encryptedMessage = symmetricKey.encrypt(message);
            console.log('Encrypted message:', encryptedMessage);

            const encryptedKeys = await Promise.all(
                counterparties.map(async (counterparty) => {
                    console.log('Encrypting key for counterparty:', counterparty);
                    const encryptedKey = await this.wallet.encrypt({
                        protocolID,
                        keyID,
                        counterparty,
                        plaintext: symmetricKey.toArray(),
                    });
                    console.log(
                        `Encrypted key for counterparty ${counterparty}:`,
                        encryptedKey.ciphertext
                    );
                    return encryptedKey.ciphertext as number[];
                })
            );

            const header = this.buildHeader(counterparties, encryptedKeys);
            console.log('Constructed header:', header);

            return { encryptedMessage: encryptedMessage as number[], header };
        } catch (error) {
            console.error('Encryption failed:', error);
            throw new Error(`Encryption failed: ${(error as Error).message}`);
        }
    }

    async decrypt(
        ciphertext: number[],
        protocolID: WalletProtocol,
        keyID: string
    ): Promise<number[]> {
        try {
            console.log('Starting decryption...');
            console.log('Ciphertext:', ciphertext);

            const { header, message } = this.parseHeader(ciphertext);
            console.log('Parsed header:', header);
            console.log('Parsed message:', message);

            const { publicKey } = await this.wallet.getPublicKey({ identityKey: true });
            console.log('Current user public key (hex):', publicKey);
            console.log('Public Key used for decryption (current user):', publicKey);

            const reader = new Utils.Reader(header);
            let symmetricKey: SymmetricKey | null = null;

            while (!reader.eof()) {
                const counterpartyLength = reader.readVarIntNum();
                console.log('Counterparty length read:', counterpartyLength);

                const counterpartyBytes = reader.read(counterpartyLength);
                console.log('Counterparty bytes read:', counterpartyBytes);

                if (!counterpartyBytes || counterpartyBytes.length !== counterpartyLength) {
                    console.error('Failed to parse counterparty from header.');
                    continue;
                }

                const counterparty = Buffer.from(counterpartyBytes).toString('hex');
                console.log('Parsed counterparty (as hex):', counterparty);

                const keyLength = reader.readVarIntNum();
                console.log('Encrypted key length read:', keyLength);

                const encryptedKey = reader.read(keyLength);
                console.log('Encrypted key for counterparty:', encryptedKey);

                if (counterparty === publicKey) {
                    console.log(`Match found for counterparty: ${counterparty}`);
                    if (!encryptedKey || encryptedKey.length === 0) {
                        console.error('No encrypted key found for this counterparty.');
                        continue;
                    }

                    const decryptedResults = await this.wallet.decrypt({
                        protocolID,
                        keyID,
                        ciphertext: encryptedKey,
                    });

                    const decryptedKeyArray = decryptedResults.plaintext;
                    console.log('Decrypted symmetric key:', decryptedKeyArray);

                    symmetricKey = new SymmetricKey(decryptedKeyArray);
                    break;
                } else {
                    console.log(`No match for counterparty: ${counterparty}`);
                }
            }

            if (!symmetricKey) {
                console.error('Symmetric key not found in the header.');
                throw new Error('Your key is not found in the header.');
            }

            const decryptedMessage = symmetricKey.decrypt(message) as number[];
            console.log('Decrypted message:', decryptedMessage);
            return decryptedMessage;
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error(`Decryption failed: ${(error as Error).message}`);
        }
    }

    buildHeader(counterparties: string[], encryptedKeys: number[][]): number[] {
        const writer = new Utils.Writer();

        console.log('Building header...');
        for (let i = 0; i < counterparties.length; i++) {
            const counterparty = counterparties[i];
            const encryptedKey = encryptedKeys[i];

            const counterpartyBytes = Array.from(Buffer.from(counterparty, 'hex'));
            console.log(`Counterparty ${i} bytes:`, counterpartyBytes);

            writer.writeVarIntNum(counterpartyBytes.length);
            writer.write(counterpartyBytes);

            console.log(`Encrypted key ${i} length:`, encryptedKey.length);
            writer.writeVarIntNum(encryptedKey.length);
            writer.write(encryptedKey);
        }

        const header = writer.toArray();
        console.log('Constructed header before length prefix:', header);

        const finalHeader = [header.length, ...header];
        console.log('Final constructed header with length prefix:', finalHeader);

        return finalHeader;
    }

    parseHeader(ciphertext: number[]): { header: number[]; message: number[] } {
        console.log('Parsing header from ciphertext...');
        const reader = new Utils.Reader(ciphertext);

        const headerLength = reader.readVarIntNum();
        console.log('Header length:', headerLength);

        if (headerLength <= 0 || headerLength > ciphertext.length) {
            console.error('Invalid header length detected.');
            throw new Error('Failed to parse header or message.');
        }

        const header = reader.read(headerLength);
        console.log('Extracted header:', header);

        if (!header || header.length !== headerLength) {
            console.error('Header data is invalid or incomplete.');
            throw new Error('Failed to parse header or message.');
        }

        const message = reader.bin.slice(reader.pos);
        console.log('Extracted message:', message);

        if (!message || message.length === 0) {
            console.error('Message data is invalid or missing.');
            throw new Error('Failed to parse header or message.');
        }

        return { header, message };
    }
}
