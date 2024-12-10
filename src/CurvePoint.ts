import { Wallet } from '@bsv/sdk';
import { SymmetricKey } from '@bsv/sdk';
import { Utils } from '@bsv/sdk';
import { WalletProtocol } from '@bsv/sdk';

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
            // Step 1: Generate a random symmetric key for encrypting the message.
            const symmetricKey = SymmetricKey.fromRandom();

            // Step 2: Encrypt the message payload using the symmetric key.
            const encryptedMessage = symmetricKey.encrypt(message);

            // Step 3: Encrypt the symmetric key for each counterparty using this.wallet.encrypt
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

            // Step 4: Build the header using `buildHeader`.
            const header = this.buildHeader(counterparties, encryptedKeys);

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
            // Step 1: Parse the header and the encrypted message from the ciphertext.
            const { header, message } = this.parseHeader(ciphertext);
    
            // Step 2: Retrieve the current user's public key.
            const { publicKey } = await this.wallet.getPublicKey({ identityKey: true });
    
            // Step 3: Parse the header to find the symmetric key for the current user.
            const reader = new Utils.Reader(header);
            let symmetricKey: SymmetricKey | null = null;
    
            while (!reader.eof()) {
                const counterpartyLength = reader.readVarIntNum(); // Read counterparty length
    
                const counterpartyBytes = reader.read(counterpartyLength); // Read the counterparty data
    
                if (!counterpartyBytes || counterpartyBytes.length !== counterpartyLength) {
                    console.error('Failed to parse counterparty from header.');
                    continue;
                }
    
                // Decode the counterparty as a full hexadecimal string
                const counterparty = Buffer.from(counterpartyBytes).toString('hex');
    
                const keyLength = reader.readVarIntNum(); // Read encrypted key length
    
                const encryptedKey = reader.read(keyLength); // Read the encrypted key
    
                // Check if the counterparty matches the user's public key
                if (counterparty === publicKey) {
                    if (!encryptedKey || encryptedKey.length === 0) {
                        console.error('No encrypted key found for this counterparty.');
                        continue;
                    }
    
                    const decryptedResults = await this.wallet.decrypt({
                        protocolID,           // Protocol to use for decryption
                        keyID,                // Key ID for identifying the decryption key
                        ciphertext: encryptedKey, // The encrypted symmetric key
                    });
    
                    const decryptedKeyArray = decryptedResults.plaintext;
    
                    symmetricKey = new SymmetricKey(decryptedKeyArray);
                    break;
                } else {
                    console.log(`No match for counterparty: ${counterparty}`);
                }
            }
    
            // Step 4: Ensure the symmetric key was found.
            if (!symmetricKey) {
                console.error('Symmetric key not found in the header.');
                throw new Error('Your key is not found in the header.');
            }
    
            // Step 5: Decrypt the message payload using the symmetric key.
            const decryptedMessage = symmetricKey.decrypt(message) as number[];
            return decryptedMessage;
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error(`Decryption failed: ${(error as Error).message}`);
        }
    }
    
    buildHeader(counterparties: string[], encryptedKeys: number[][]): number[] {
        const writer = new Utils.Writer();
    
        // Reserve space for the total header length
        const headerStart = writer.toArray();
        
        for (let i = 0; i < counterparties.length; i++) {
            const counterparty = counterparties[i];
            const encryptedKey = encryptedKeys[i];
    
            // Encode the counterparty as bytes
            const counterpartyBytes = Array.from(Buffer.from(counterparty, 'hex'));
    
            // Write counterparty data
            writer.writeVarIntNum(counterpartyBytes.length);
            writer.write(counterpartyBytes);
    
            // Write encrypted key data
            writer.writeVarIntNum(encryptedKey.length);
            writer.write(encryptedKey);
        }
    
        const header = writer.toArray();
    
        // Prepend the total header length
        const finalHeader = [header.length, ...header];
        return finalHeader;
    }
    
    parseHeader(ciphertext: number[]): { header: number[]; message: number[] } {
        const reader = new Utils.Reader(ciphertext);
    
        // Read the total header length
        const totalHeaderLength = reader.readVarIntNum();
    
        // Validate the header length
        if (totalHeaderLength > ciphertext.length) {
            console.error('Malformed ciphertext: Header length exceeds ciphertext size.');
            throw new Error('Malformed ciphertext.');
        }
    
        // Extract the header and message
        const header = reader.read(totalHeaderLength) ?? [];
        const message = reader.bin.slice(reader.pos);
    
        return { header, message };
    }
}
