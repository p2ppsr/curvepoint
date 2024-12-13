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
            // Step 1: Parse the header and message
            const { header, message } = this.parseHeader(ciphertext);
    
            // Step 2: Retrieve the participant's public key
            const { publicKey } = await this.wallet.getPublicKey({ identityKey: true });
            console.log('Participant public key:', publicKey);
    
            // Step 3: Iterate through the header to find the participant
            const reader = new Utils.Reader(header);
            let symmetricKey: SymmetricKey | null = null;
    
            while (!reader.eof()) {
                // Read counterparty public key
                const counterpartyLength = reader.readVarIntNum();
                const counterpartyBytes = reader.read(counterpartyLength);
                const counterparty = Buffer.from(counterpartyBytes).toString('hex');
    
                // Read the encrypted symmetric key
                const keyLength = reader.readVarIntNum();
                const encryptedKey = reader.read(keyLength);
    
                console.log(`Found counterparty: ${counterparty}`);
    
                if (counterparty === publicKey) {
                    console.log(`Match found for public key: ${publicKey}`);
    
                    try {
                        // Step 4: Decrypt the symmetric key
                        const decryptedResults = await this.wallet.decrypt({
                            protocolID,
                            keyID,
                            ciphertext: encryptedKey,
                        });
    
                        // Step 5: Create the SymmetricKey
                        symmetricKey = new SymmetricKey(decryptedResults.plaintext);
                        console.log('Symmetric key successfully derived.');
                        break;
                    } catch (error) {
                        console.error('Failed to decrypt the symmetric key:', error);
                        throw new Error('Failed to decrypt the symmetric key.');
                    }
                }
            }
    
            // Step 6: Handle case where no matching public key was found
            if (!symmetricKey) {
                console.error('No matching public key found in the header.');
                throw new Error('Your key is not found in the header.');
            }
    
            // Step 7: Decrypt the message
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

    
            // Parse the message
            const message = reader.bin.slice(reader.pos);

    
            // Validate the parsed header
            if (header.length !== headerLength) {
                console.error('Header length mismatch. Expected:', headerLength, 'Got:', header.length);
                throw new Error('Failed to parse header or message.');
            }
    
            // // Decode the header for detailed debugging
            // console.log('Decoding header for validation...');
            // const tempReader = new Utils.Reader(header);
            // while (!tempReader.eof()) {
            //     const counterpartyLength = tempReader.readVarIntNum();
            //     const counterpartyBytes = tempReader.read(counterpartyLength);
            //     const counterparty = Buffer.from(counterpartyBytes).toString('hex');
    
            //     const keyLength = tempReader.readVarIntNum();
            //     const encryptedKey = tempReader.read(keyLength);
    
            //     console.log(`Decoded counterparty: ${counterparty}`);
            //     console.log(`Decoded encrypted key:`, encryptedKey);
            // }
    
            return { header, message };
        } catch (error) {
            console.error('Error parsing header:', error);
            throw error;
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

    
        // Parse the header into counterparties and encrypted keys using parseHeader
        const { header: parsedHeader } = this.parseHeader(header);

    
        const reader = new Utils.Reader(parsedHeader);
        const counterparties: string[] = [];
        const encryptedKeys: number[][] = [];
    

        while (!reader.eof()) {
            const counterpartyLength = reader.readVarIntNum();
            const counterpartyBytes = reader.read(counterpartyLength);
            const counterparty = Buffer.from(counterpartyBytes).toString('hex');

    
            const keyLength = reader.readVarIntNum();
            const encryptedKey = reader.read(keyLength);

    
            // Exclude the target participant
            if (counterparty !== targetParticipant) {
                console.log(`Keeping participant ${counterparty}`);
                counterparties.push(counterparty);
                encryptedKeys.push(encryptedKey);
            } else {
                console.log(`Excluding participant ${counterparty}`);
            }
        }
    
        console.log('Final list of counterparties after parsing:', counterparties);
    
        // Validate removal
        if (counterparties.includes(targetParticipant)) {
            throw new Error('Failed to remove participant from the header.');
        }
    
        // Rebuild and return the updated header
        const updatedHeader = this.buildHeader(counterparties, encryptedKeys);



        // Compare the updated header with the original header
        if (JSON.stringify(updatedHeader) === JSON.stringify(header)) {
            throw new Error('Updated header is identical to the original header. Removal failed.');
        }
    
        return updatedHeader;
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
