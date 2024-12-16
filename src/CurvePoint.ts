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
            // Step 1: Generate a symmetric key
            const symmetricKey = SymmetricKey.fromRandom();
    
            // Step 2: Encrypt the message with the symmetric key
            const encryptedMessage = symmetricKey.encrypt(message);
    
            // Step 3: Encrypt the symmetric key for each counterparty
            const encryptedKeys = await Promise.all(
                counterparties.map(async (counterparty) => {
                    // Encrypt the symmetric key for the counterparty
                    const encryptedKey = await this.wallet.encrypt({
                        protocolID,
                        keyID,
                        counterparty,
                        plaintext: symmetricKey.toArray(), // Send the symmetric key
                    });
                    console.log(`Encrypted symmetric key for counterparty ${counterparty}:`, encryptedKey.ciphertext);
                    return encryptedKey.ciphertext as number[]; // Store the ciphertext
                })
            );
    
            // Step 4: Build the header with counterparties and encrypted keys
            const header = this.buildHeader(counterparties, encryptedKeys);
            console.log('Header constructed with counterparties and encrypted keys:', { counterparties, encryptedKeys });
    
            return { encryptedMessage: encryptedMessage as number[], header };
        } catch (error) {
            console.error(`Encryption failed: ${(error as Error).message}`);
            throw new Error(`Encryption failed: ${(error as Error).message}`);
        }
    }
    
    
    

    async decrypt(
        ciphertext: number[],
        protocolID: WalletProtocol,
        keyID: string
    ): Promise<number[]> {
        try {
            // Step 1: Parse the header and message from the ciphertext
            const { header, message } = this.parseHeader(ciphertext);
    
            // Step 2: Retrieve the recipient's public key
            const { publicKey } = await this.wallet.getPublicKey({ identityKey: true });
            console.log('Recipient public key:', publicKey);
    
            // Step 3: Find the recipient's encrypted symmetric key in the header
            const reader = new Utils.Reader(header);
            let symmetricKey: SymmetricKey | null = null;
            let publicKeyFound = false;
    
            while (!reader.eof()) {
                // Read counterparty public key
                const counterpartyLength = reader.readVarIntNum();
                const counterpartyBytes = reader.read(counterpartyLength);
                const counterparty = Buffer.from(counterpartyBytes).toString('hex');
    
                console.log(`Processing counterparty: ${counterparty}`);
    
                // Read the encrypted symmetric key
                const keyLength = reader.readVarIntNum();
                const encryptedKey = reader.read(keyLength);
    
                // Check if the recipient's public key matches the counterparty
                if (counterparty === publicKey) {
                    publicKeyFound = true;
                    console.log(`Match found for public key: ${publicKey}`);
    
                    // Decrypt the symmetric key using the recipient's wallet
                    const decryptedResults = await this.wallet.decrypt({
                        protocolID,
                        keyID,
                        ciphertext: encryptedKey,
                    });
                    console.log('Symmetric key decrypted:', decryptedResults.plaintext);
    
                    // Create the symmetric key for decryption
                    symmetricKey = new SymmetricKey(decryptedResults.plaintext);
                    console.log('Symmetric key successfully derived.');
                    break; // Stop processing once the symmetric key is derived
                }
            }
    
            // Step 4: Handle cases where the recipient's key is not found or decryption fails
            if (!publicKeyFound) {
                console.error('Recipient public key not found in the header.');
                throw new Error('Your key is not found in the header.');
            }
    
            if (!symmetricKey) {
                console.error('Failed to derive a symmetric key from the header.');
                throw new Error('Symmetric key not found in the header.');
            }
    
            // Step 5: Decrypt the message using the derived symmetric key
            const decryptedMessage = symmetricKey.decrypt(message) as number[];
            console.log('Message successfully decrypted.');
            return decryptedMessage;
        } catch (error) {
            console.error(`Decryption failed: ${(error as Error).message}`);
            throw new Error(`Decryption failed: ${(error as Error).message}`);
        }
    }
    
    
  
    
    
    
    
    
    

    buildHeader(counterparties: string[], encryptedKeys: number[][]): number[] {
        const writer = new Utils.Writer();
    
        console.log('Counterparties:', counterparties);
    
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
        try {
            const reader = new Utils.Reader(ciphertext);
    
            // Parse the header length
            const headerLength = reader.readVarIntNum();
    
            // Parse the header
            const header = reader.read(headerLength);
    
            // Handle cases where no message exists
            const remainingBytes = reader.bin.slice(reader.pos);
            const message = remainingBytes.length > 0 ? remainingBytes : [];
    
            // Validate the header structure
            const tempReader = new Utils.Reader(header);
            while (!tempReader.eof()) {
                const counterpartyLength = tempReader.readVarIntNum();
                if (counterpartyLength <= 0 || counterpartyLength > 1000) {
                    throw new Error('Malformed header: Invalid counterparty length.');
                }
    
                const counterpartyBytes = tempReader.read(counterpartyLength);
                if (!counterpartyBytes || counterpartyBytes.length !== counterpartyLength) {
                    throw new Error('Malformed header: Counterparty bytes do not match length.');
                }
    
                const keyLength = tempReader.readVarIntNum();
                if (keyLength <= 0 || keyLength > 1000) {
                    throw new Error('Malformed header: Invalid key length.');
                }
    
                const encryptedKey = tempReader.read(keyLength);
                if (!encryptedKey || encryptedKey.length !== keyLength) {
                    throw new Error('Malformed header: Encrypted key bytes do not match length.');
                }
            }
    
            return { header, message };
        } catch (error) {
            console.error(`Error Parsing Header: ${(error as Error).message}`);
            throw new Error('Failed to parse header or message.');
        }
    }
    
    
    
    

    async addParticipant(
        header: number[],
        newParticipant: string,
        protocolID: WalletProtocol,
        keyID: string
    ): Promise<number[]> {
        const { header: existingHeader } = this.parseHeader(header);

        // Decrypt the symmetric key from the header
        const symmetricKey = await this.extractSymmetricKey(existingHeader, protocolID, keyID);

        // Encrypt the symmetric key for the new participant
        const encryptedKey = await this.wallet.encrypt({
            protocolID,
            keyID,
            counterparty: newParticipant,
            plaintext: symmetricKey.toArray(),
        });

        const reader = new Utils.Reader(existingHeader);
        const counterparties: string[] = [];
        const encryptedKeys: number[][] = [];

        // Parse existing header
        while (!reader.eof()) {
            const counterpartyLength = reader.readVarIntNum();
            const counterpartyBytes = reader.read(counterpartyLength);
            counterparties.push(Buffer.from(counterpartyBytes).toString('hex'));

            const keyLength = reader.readVarIntNum();
            const encryptedKey = reader.read(keyLength);
            encryptedKeys.push(encryptedKey);
        }

        // Add new participant
        if (counterparties.includes(newParticipant)) {
            throw new Error('Participant already exists in the header.');
        }
        counterparties.push(newParticipant);
        encryptedKeys.push(encryptedKey.ciphertext as number[]);

        // Rebuild header
        return this.buildHeader(counterparties, encryptedKeys);
    }

    async removeParticipant(header: number[], targetParticipant: string): Promise<number[]> {
        try {
            console.log('Header before parsing:', header);
    
            // Parse the header
            const { header: parsedHeader } = this.parseHeader(header);
    
            const reader = new Utils.Reader(parsedHeader);
            const counterparties: string[] = [];
            const encryptedKeys: number[][] = [];
    
            // Parse the header to extract counterparties and keys
            while (!reader.eof()) {
                const counterpartyLength = reader.readVarIntNum();
                const counterpartyBytes = reader.read(counterpartyLength);
                const counterparty = Buffer.from(counterpartyBytes).toString('hex');
    
                const keyLength = reader.readVarIntNum();
                const encryptedKey = reader.read(keyLength);
    
                if (counterparty !== targetParticipant) {
                    // Keep only counterparties not being revoked
                    console.log(`Keeping participant ${counterparty}`);
                    counterparties.push(counterparty);
                    encryptedKeys.push(encryptedKey);
                } else {
                    console.log(`Excluding participant ${counterparty}`);
                    console.log(`Encrypted key for revoked participant: ${encryptedKey}`);
                }
            }
    
            console.log('Final list of counterparties after parsing:', counterparties);
            console.log('Final list of encrypted keys after parsing:', encryptedKeys);
    
            // Validate removal
            if (counterparties.includes(targetParticipant)) {
                throw new Error('Failed to remove participant from the header.');
            }
            
    
            // Log removed counterparties and keys for debugging
            console.log(`Counterparties after removal: ${JSON.stringify(counterparties)}`);
            console.log(`Encrypted keys after removal: ${JSON.stringify(encryptedKeys)}`);
    
            // Rebuild the header
            const updatedHeader = this.buildHeader(counterparties, encryptedKeys);
    
            console.log('Updated Header:', updatedHeader);
    
            // Return the updated header
            return updatedHeader;
        } catch (error) {
            console.error(`Error removing participant: ${(error instanceof Error) ? error.message : error}`);
            throw new Error('Failed to remove participant.');
        }
    }
    
    
    
    
    
    
    

    private async extractSymmetricKey(
        header: number[],
        protocolID: WalletProtocol,
        keyID: string
    ): Promise<SymmetricKey> {
        const reader = new Utils.Reader(header);
        const { publicKey } = await this.wallet.getPublicKey({ identityKey: true });
    
        while (!reader.eof()) {
            const counterpartyLength = reader.readVarIntNum();
            const counterpartyBytes = reader.read(counterpartyLength);
            const counterparty = Buffer.from(counterpartyBytes).toString('hex');
    
            const keyLength = reader.readVarIntNum();
            const encryptedKey = reader.read(keyLength);
    
            if (counterparty === publicKey) {
                const decryptedResults = await this.wallet.decrypt({
                    protocolID,
                    keyID,
                    ciphertext: encryptedKey,
                });
                return new SymmetricKey(decryptedResults.plaintext);
            }
        }
    
        throw new Error('Your key is not found in the header.');
    }
    
}
