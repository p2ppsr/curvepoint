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
        recipients: string[]
    ): Promise<{ encryptedMessage: number[]; header: number[] }> {
        try {
            // Step 1: Generate the symmetric key for message encryption
            const symmetricKey = SymmetricKey.fromRandom();
    
            // Step 2: Encrypt the message with the symmetric key
            const encryptedMessage = symmetricKey.encrypt(message);
    
            // Step 3: Retrieve the sender's public key
            const { publicKey: senderPublicKey } = await this.wallet.getPublicKey({ identityKey: true });
    
            // Step 4: Encrypt the symmetric key for each recipient
            const encryptedKeys = await Promise.all(
                recipients.map(async (recipient) => {
                    const encryptedKey = await this.wallet.encrypt({
                        protocolID,
                        keyID,
                        counterparty: recipient, // Recipient's public key
                        plaintext: symmetricKey.toArray(), // Symmetric key as plaintext
                    });
    
                    return {
                        ciphertext: encryptedKey.ciphertext as number[],
                    };
                })
            );
    
            // Step 5: Build the header
            const header = this.buildHeader(senderPublicKey, recipients, encryptedKeys);
    
            //console.log('Header constructed:', header);
            //console.log('Encrypted Message:', encryptedMessage);
    
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
            // Step 1: Parse the header and message
            const { header, message } = this.parseHeader(ciphertext);
    
            // Step 2: Retrieve the recipient's public key
            const { publicKey: recipientPublicKey } = await this.wallet.getPublicKey({
                identityKey: true,
            });
            //console.log('Recipient public key:', recipientPublicKey);
    
            // Step 3: Parse the header
            const reader = new Utils.Reader(header);
    
            // Read version
            const version = reader.readUInt32LE();
            //console.log('Header Version:', version);
    
            if (version !== 0x00000001) {
                throw new Error('Unsupported header version.');
            }
    
            // Read number of recipients
            const numRecipients = reader.readVarIntNum();
            //console.log('Number of Recipients:', numRecipients);
    
            let symmetricKey: SymmetricKey | null = null;
    
            // Step 4: Iterate through recipients in the header
            for (let i = 0; i < numRecipients; i++) {
                try {
                    // Read recipient's public key
                    const recipientPublicKeyBytes = reader.read(33);
                    const recipientKey = Buffer.from(recipientPublicKeyBytes).toString('hex');
    
                    // Read sender's public key
                    const senderPublicKeyBytes = reader.read(33);
                    const senderKey = Buffer.from(senderPublicKeyBytes).toString('hex');
    
                    // Read length of the encrypted symmetric key
                    const encryptedKeyLength = reader.readVarIntNum();
    
                    // Read the encrypted symmetric key
                    const encryptedKey = reader.read(encryptedKeyLength);
    
                    // console.log(`Processing recipient entry ${i}:`, {
                    //     recipientKey,
                    //     senderKey,
                    //     encryptedKeyLength,
                    //     encryptedKey,
                    // });
    
                    // Check if this recipient key matches the recipient's public key
                    if (recipientKey === recipientPublicKey) {
                        //console.log('Match found for recipient public key:', recipientPublicKey);
    
                        // Step 5: Decrypt the symmetric key using the sender's public key as counterparty
                        try {
                            const decryptedResults = await this.wallet.decrypt({
                                protocolID,
                                keyID,
                                counterparty: senderKey, // Sender's public key from header
                                ciphertext: encryptedKey,
                            });
                            //console.log('Symmetric key decrypted successfully:', decryptedResults.plaintext);
    
                            // Step 6: Derive the symmetric key
                            symmetricKey = new SymmetricKey(decryptedResults.plaintext);
                            //console.log('Symmetric key successfully derived:', decryptedResults.plaintext);
                            break; // Exit the loop as the symmetric key is successfully derived
                        } catch (error) {
                            console.error(`Decryption failed!`);
                            // Continue processing other entries without breaking the loop
                            continue;
                        }
                    }
                } catch (error) {
                    console.error('Failed to process recipient entry: ${(error as Error).message}');
                }
            }
    
            // Step 7: Handle errors if no symmetric key was found
            if (!symmetricKey) {
                console.error('No matching symmetric key found in the header.');
                throw new Error('Your key is not found in the header.');
            }
    
            // Step 8: Decrypt the message with the symmetric key
            const decryptedMessage = symmetricKey.decrypt(message) as number[];
            //console.log('Message successfully decrypted.');
            return decryptedMessage;
        } catch (error) {
            console.error(`Decryption failed: ${(error as Error).message}`);
            throw new Error(`Decryption failed: ${(error as Error).message}`);
        }
    }
    
    
    
    
    
  
    
    
    
    
    
    

    buildHeader(
        senderPublicKey: string,
        recipients: string[],
        encryptedKeys: { ciphertext: number[] }[]
    ): number[] {
        const writer = new Utils.Writer();
    
        // Helper function for validating a public key
        const validatePublicKey = (key: string): boolean => {
            return key.length === 66 && /^[0-9a-fA-F]+$/.test(key); // 66 hex chars = 33 bytes
        };
    
        console.log('--- Start Building Header ---');
        console.log('Sender Public Key:', senderPublicKey);
    
        // Step 1: Validate the sender's public key
        if (!validatePublicKey(senderPublicKey)) {
            throw new Error(`Invalid sender public key: ${senderPublicKey}`);
        }
    
        // Step 2: Write version (4 bytes)
        const version = 0x00000001;
        writer.writeUInt32LE(version);
        console.log('Header Version:', version);
    
        // Step 3: Validate recipients and encrypted keys
        const cleanedRecipients: string[] = [];
        const cleanedEncryptedKeys: { ciphertext: number[] }[] = [];
    
        recipients.forEach((recipient, index) => {
            const encryptedKey = encryptedKeys[index];
            if (!validatePublicKey(recipient)) {
                console.warn(`Skipping invalid recipient public key at index ${index}: ${recipient}`);
                return;
            }
    
            if (!encryptedKey || encryptedKey.ciphertext.length === 0) {
                console.warn(`Skipping recipient with invalid ciphertext at index ${index}:`, encryptedKey);
                return;
            }
    
            cleanedRecipients.push(recipient);
            cleanedEncryptedKeys.push(encryptedKey);
        });
    
        if (cleanedRecipients.length === 0) {
            throw new Error('No valid recipients found to build the header.');
        }
    
        // Step 4: Write the number of valid recipients
        writer.writeVarIntNum(cleanedRecipients.length);
        console.log('Number of Recipients:', cleanedRecipients.length);
    
        // Step 5: Write each recipient's entry
        cleanedRecipients.forEach((recipient, i) => {
            const recipientPublicKey = Array.from(Buffer.from(recipient, 'hex'));
            const senderPublicKeyBytes = Array.from(Buffer.from(senderPublicKey, 'hex'));
            const encryptedKey = cleanedEncryptedKeys[i].ciphertext;
    
            // Write recipient's public key (33 bytes)
            writer.write(recipientPublicKey);
    
            // Write sender's public key (33 bytes)
            writer.write(senderPublicKeyBytes);
    
            // Write length of the encrypted symmetric key
            writer.writeVarIntNum(encryptedKey.length);
    
            // Write the encrypted symmetric key
            writer.write(encryptedKey);
    
            console.log(`Recipient ${i}:`, {
                recipientPublicKey: recipient,
                senderPublicKey: senderPublicKey,
                ciphertextLength: encryptedKey.length,
                ciphertext: encryptedKey,
            });
        });
    
        // Step 6: Get the full header content
        const headerContent = writer.toArray();
        console.log('Raw Header Content:', headerContent);
    
        // Step 7: Prepend the length of the header
        const finalWriter = new Utils.Writer();
        finalWriter.writeVarIntNum(headerContent.length); // Prepend the length
        finalWriter.write(headerContent); // Append the full header content
    
        const fullHeader = finalWriter.toArray();
        console.log('Final Constructed Header:', fullHeader);
    
        console.log('--- End Building Header ---');
    
        return fullHeader;
    }
    
    
    
    
    
    

    parseHeader(ciphertext: number[]): { header: number[]; message: number[] } {
        try {
            const reader = new Utils.Reader(ciphertext);
    
            console.log('--- Start Parsing Header ---');

            // Step 1: Read and validate header length
            const headerLength = reader.readVarIntNum();
            console.log('Parsed Header Length:', headerLength);
    
            if (headerLength > reader.bin.length - reader.pos) {
                throw new Error('Header length exceeds available data.');
            }
    
            const header = reader.read(headerLength);
            console.log('Header:', header);
    
            // Step 2: Parse the header content
            const tempReader = new Utils.Reader(header);
    
            // Step 3: Validate version
            const version = tempReader.readUInt32LE();
            console.log('Header Version:', version);
    
            if (version < 1) {
                throw new Error(`Unsupported or invalid header version: ${version}`);
            }
    
            // Step 4: Validate number of recipients
            const numRecipients = tempReader.readVarIntNum();
            console.log('Number of Recipients:', numRecipients);
    
            if (numRecipients <= 0) {
                throw new Error('No recipients found in the header.');
            }
    
            // Step 5: Read and validate each recipient entry
            const recipients = [];
            for (let i = 0; i < numRecipients; i++) {
                // Read fixed-length recipient key (33 bytes)
                const recipientKey = tempReader.read(33);
                if (recipientKey.length !== 33) {
                    console.warn(`Skipping malformed recipient at index ${i}: invalid key length.`);
                    continue;
                }
                console.log(`Recipient ${i} Public Key:`, Buffer.from(recipientKey).toString('hex'));
    
                // Read fixed-length sender key (33 bytes)
                const senderKey = tempReader.read(33);
                if (senderKey.length !== 33) {
                    console.warn(`Skipping malformed sender at index ${i}: invalid key length.`);
                    continue;
                }
                console.log(`Sender ${i} Public Key:`, Buffer.from(senderKey).toString('hex'));
    
                // Read and validate encrypted key
                const encryptedKeyLength = tempReader.readVarIntNum();
                const encryptedKey = tempReader.read(encryptedKeyLength);
    
                if (encryptedKey.length !== encryptedKeyLength) {
                    console.warn(`Skipping malformed entry at index ${i}: encrypted key length mismatch.`);
                    continue;
                }
                console.log(`Encrypted Key for Recipient ${i}:`, encryptedKey);
    
                recipients.push({
                    recipientPublicKey: Buffer.from(recipientKey).toString('hex'),
                    senderPublicKey: Buffer.from(senderKey).toString('hex'),
                    encryptedKey: encryptedKey,
                });
            }
    
            // Step 6: Extract remaining message
            const remainingBytes = reader.bin.slice(reader.pos);
            const message = remainingBytes.length > 0 ? remainingBytes : [];
            console.log('Remaining Message Bytes:', message);
    
            console.log('--- End Parsing Header ---');

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
        try {
            // Step 1: Parse the existing header
            const { header: existingHeader } = this.parseHeader(header);
            const reader = new Utils.Reader(existingHeader);
    
            const entries: {
                recipientPublicKey: string;
                senderPublicKey: string;
                encryptedKey: number[];
            }[] = [];
    
            // Parse existing header entries
            while (!reader.eof()) {
                const recipientPublicKeyBytes = reader.read(33);
                const recipientPublicKey = Buffer.from(recipientPublicKeyBytes).toString('hex');
    
                const senderPublicKeyBytes = reader.read(33);
                const senderPublicKey = Buffer.from(senderPublicKeyBytes).toString('hex');
    
                const encryptedKeyLength = reader.readVarIntNum();
                const encryptedKey = reader.read(encryptedKeyLength);
    
                entries.push({
                    recipientPublicKey,
                    senderPublicKey,
                    encryptedKey,
                });
            }
    
            // Step 2: Check if the new participant already exists
            if (entries.some(entry => entry.recipientPublicKey === newParticipant)) {
                throw new Error('Participant already exists in the header.');
            }
    
            // Step 3: Retrieve the sender's public key
            const { publicKey: senderPublicKey } = await this.wallet.getPublicKey({
                identityKey: true,
            });
            console.log(`Sender's Public Key: ${senderPublicKey}`);
    
            // Step 4: Decrypt the symmetric key
            const symmetricKey = await this.extractSymmetricKey(existingHeader, protocolID, keyID);
    
            // Step 5: Encrypt the symmetric key for the new participant
            const encryptedKeyResult = await this.wallet.encrypt({
                protocolID,
                keyID,
                counterparty: newParticipant,
                plaintext: symmetricKey.toArray(),
            });
            const newEncryptedKey = encryptedKeyResult.ciphertext as number[];
    
            // Step 6: Add the new participant entry
            entries.push({
                recipientPublicKey: newParticipant,
                senderPublicKey,
                encryptedKey: newEncryptedKey,
            });
    
            // Step 7: Rebuild the header
            const writer = new Utils.Writer();
    
            writer.writeUInt32LE(0x00000001); // Write version
            writer.writeVarIntNum(entries.length); // Write number of recipients
    
            for (const entry of entries) {
                const recipientKeyBytes = Array.from(Buffer.from(entry.recipientPublicKey, 'hex'));
                const senderKeyBytes = Array.from(Buffer.from(entry.senderPublicKey, 'hex'));
    
                writer.write(recipientKeyBytes); // Write recipient's public key
                writer.write(senderKeyBytes); // Write sender's public key
                writer.writeVarIntNum(entry.encryptedKey.length); // Write encrypted key length
                writer.write(entry.encryptedKey); // Write encrypted symmetric key
            }
    
            const updatedHeader = writer.toArray();
            console.log('Updated Header:', updatedHeader);
    
            return updatedHeader;
        } catch (error) {
            console.error(`Error adding participant: ${(error as Error).message}`);
            throw new Error('Failed to add new participant to the header.');
        }
    }
    

    async removeParticipant(iheader: number[], targetParticipant: string): Promise<number[]> {
        try {
            console.log('Header before parsing:', iheader);
    
            // Step 1: Parse the header
            const { header, message } = this.parseHeader(iheader);
            const reader = new Utils.Reader(header);
    
            // Step 2: Read and validate the version
            const version = reader.readUInt32LE();
            console.log('Header Version:', version);
    
            if (version < 1) {
                throw new Error(`Unsupported header version: ${version}`);
            }
    
            // Step 3: Read the number of recipients
            const numRecipients = reader.readVarIntNum();
            console.log('Number of Recipients:', numRecipients);
    
            if (numRecipients <= 0) {
                throw new Error('No recipients found in the header.');
            }
    
            const recipients: string[] = [];
            const encryptedKeys: { ciphertext: number[] }[] = [];
            let senderPublicKey: string | null = null;
    
            // Step 4: Parse recipient entries and exclude the target participant
            for (let i = 0; i < numRecipients; i++) {
                try {
                    // Read recipient public key (fixed 33 bytes)
                    const recipientPublicKeyBytes = reader.read(33);
                    if (recipientPublicKeyBytes.length !== 33) {
                        console.warn(`Skipping malformed entry at index ${i}: Invalid recipient key length`);
                        continue;
                    }
                    const recipientPublicKey = Buffer.from(recipientPublicKeyBytes).toString('hex');
    
                    // Read sender public key (fixed 33 bytes)
                    const senderPublicKeyBytes = reader.read(33);
                    if (senderPublicKeyBytes.length !== 33) {
                        console.warn(`Skipping malformed entry at index ${i}: Invalid sender key length`);
                        continue;
                    }
                    senderPublicKey = Buffer.from(senderPublicKeyBytes).toString('hex');
    
                    // Read and validate encrypted key
                    const encryptedKeyLength = reader.readVarIntNum();
                    const encryptedKey = reader.read(encryptedKeyLength);
                    if (encryptedKey.length !== encryptedKeyLength) {
                        console.warn(`Skipping malformed entry at index ${i}: Invalid encrypted key length`);
                        continue;
                    }
    
                    // Check if this is the participant to exclude
                    if (recipientPublicKey === targetParticipant) {
                        console.log(`Excluding participant: ${recipientPublicKey}`);
                    } else {
                        console.log(`Keeping participant: ${recipientPublicKey}`);
                        recipients.push(recipientPublicKey);
                        encryptedKeys.push({ ciphertext: encryptedKey });
                    }
                } catch (parseError) {
                    console.warn(`Error parsing recipient entry at index ${i}:`, parseError);
                    continue;
                }
            }
    
            // Ensure senderPublicKey is not null
            if (!senderPublicKey) {
                throw new Error('Sender public key not found in the header.');
            }
    
            console.log('Final list of recipients after parsing:', recipients);
            console.log('Sender public key:', senderPublicKey);
            console.log('Encrypted keys:', encryptedKeys);
    
            // Step 5: Ensure the target participant was successfully removed
            if (recipients.includes(targetParticipant)) {
                throw new Error('Failed to remove participant from the header.');
            }
    
            // Step 6: Reconstruct the updated header
            const updatedHeader = this.buildHeader(senderPublicKey, recipients, encryptedKeys);
            console.log('Updated Header after revocation:', updatedHeader);
    
            return updatedHeader;
        } catch (error) {
            console.error(
                `Error removing participant: ${(error instanceof Error) ? error.message : error}`
            );
            throw new Error('Failed to remove participant.');
        }
    }
    
    
    
    
    
    
    
    
    
    
    

    private async extractSymmetricKey(
        header: number[],
        protocolID: WalletProtocol,
        keyID: string
    ): Promise<SymmetricKey> {
        const reader = new Utils.Reader(header);
    
        // Retrieve the participant's public key
        const { publicKey } = await this.wallet.getPublicKey({ identityKey: true });
        console.log('Participant public key:', publicKey);
    
        while (!reader.eof()) {
            try {
                // Step 1: Read recipient public key
                const recipientPublicKeyBytes = reader.read(33); // 33-byte compressed DER format
                const recipientPublicKey = Buffer.from(recipientPublicKeyBytes).toString('hex');
    
                // Step 2: Read sender public key
                const senderPublicKeyBytes = reader.read(33); // 33-byte compressed DER format
                const senderPublicKey = Buffer.from(senderPublicKeyBytes).toString('hex');
    
                // Step 3: Read the encrypted symmetric key
                const encryptedKeyLength = reader.readVarIntNum(); // Encrypted key length
                const encryptedKey = reader.read(encryptedKeyLength);
    
                //console.log(`Processing recipient: ${recipientPublicKey}, sender: ${senderPublicKey}`);
    
                // Step 4: Check if this entry is for the current participant
                if (recipientPublicKey === publicKey) {
                    //console.log(`Match found for recipientPublicKey: ${recipientPublicKey}`);
                    //console.log('Attempting to decrypt symmetric key...');
    
                    // Decrypt the symmetric key using the recipient's wallet
                    const decryptedResults = await this.wallet.decrypt({
                        protocolID,
                        keyID,
                        ciphertext: encryptedKey,
                    });
    
                    //console.log('Symmetric key successfully decrypted:', decryptedResults.plaintext);
                    return new SymmetricKey(decryptedResults.plaintext); // Return the symmetric key
                }
            } catch (error) {
                console.error('Error processing header entry:', error);
                continue; // Continue to the next entry if there's an issue
            }
        }
    
        // Throw an error if the recipient's public key is not found
        throw new Error('Your public key is not found in the header.');
    }    
    
}
