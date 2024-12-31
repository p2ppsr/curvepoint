/**
 * CurvePoint
 * 
 * Provides functionality for secure group messaging using elliptic curve cryptography.
 * 
 * Key features:
 * - Encrypt messages for a group with individual symmetric key sharing.
 * - Decrypt messages intended for a specific recipient.
 * - Manage group participants, including adding and revoking access.
 */
import { Wallet } from '@bsv/sdk';
import { SymmetricKey } from '@bsv/sdk';
import { Utils } from '@bsv/sdk';
import { WalletProtocol } from '@bsv/sdk';

export class CurvePoint {
    private wallet: Wallet;

    /**
     * Initializes a new CurvePoint instance.
     * 
     * @param wallet - The wallet instance providing cryptographic operations.
     */
    constructor(wallet: Wallet) {
        this.wallet = wallet;
    }

    /**
 * Encrypts a message for a group of recipients.
 * 
 * @param message - The plaintext message to encrypt as an array of bytes.
 * @param protocolID - The protocol ID defining cryptographic context.
 * @param keyID - A unique identifier for the key used.
 * @param recipients - An array of recipient public keys in hex format.
 * @returns An object containing the encrypted message and the message header.
 * @throws Will throw an error if no recipients are provided.
 */
async encrypt(
    message: number[],
    protocolID: WalletProtocol,
    keyID: string,
    recipients: string[],
): Promise<{ encryptedMessage: number[]; header: number[] }> {
    try {
        // Step 1: Validate recipients
        if (recipients.length === 0) {
            throw new Error('No recipients specified for encryption.');
        }

        // Ensure recipients are unique
        const uniqueRecipients = Array.from(new Set(recipients));

        // Step 2: Generate the symmetric key for message encryption
        const symmetricKey = SymmetricKey.fromRandom();

        // Step 3: Encrypt the message with the symmetric key
        const encryptedMessage = symmetricKey.encrypt(message);

        // Step 4: Retrieve the sender's public key
        const { publicKey: senderPublicKey } = await this.wallet.getPublicKey({ identityKey: true });

        // Step 5: Encrypt the symmetric key for each unique recipient
        const encryptedKeys = await Promise.all(
            uniqueRecipients.map(async (recipient) => {
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

        const version = 0x00000000;

        // Step 6: Build the header
        const header = this.buildHeader(senderPublicKey, uniqueRecipients, encryptedKeys, version);

        return { encryptedMessage: encryptedMessage as number[], header };
    } catch (error) {
        console.error(`Encryption failed: ${(error as Error).message}`);
        throw new Error(`Encryption failed: ${(error as Error).message}`);
    }
}

    /**
     * Decrypts a message intended for the recipient.
     * 
     * @param ciphertext - The ciphertext containing the message header and encrypted message.
     * @param protocolID - The protocol ID defining cryptographic context.
     * @param keyID - A unique identifier for the key used.
     * @returns The decrypted message as an array of bytes.
     */
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
    
            // Step 3: Parse the header
            const reader = new Utils.Reader(header);
    
            // Read version
            const version = reader.readUInt32LE();
    
            // Read number of recipients
            const numRecipients = reader.readVarIntNum();
    
            let symmetricKey: SymmetricKey | null = null;
    
            // Step 4: Iterate through recipients in the header
            for (let i = 0; i < numRecipients; i++) {
                try {
                    // Read recipient's public key
                    const recipientPublicKeyBytes = reader.read(33);
                    const recipientKey = Utils.toHex(recipientPublicKeyBytes);
    
                    // Read sender's public key
                    const senderPublicKeyBytes = reader.read(33);
                    const senderKey = Utils.toHex(senderPublicKeyBytes);
    
                    // Read length of the encrypted symmetric key
                    const encryptedKeyLength = reader.readVarIntNum();
    
                    // Read the encrypted symmetric key
                    const encryptedKey = reader.read(encryptedKeyLength);
    
                    // Check if this recipient key matches the recipient's public key
                    if (recipientKey === recipientPublicKey) {
    
                        // Step 5: Decrypt the symmetric key using the sender's public key as counterparty
                        try {
                            const decryptedResults = await this.wallet.decrypt({
                                protocolID,
                                keyID,
                                counterparty: senderKey, // Sender's public key from header
                                ciphertext: encryptedKey,
                            });
    
                            // Step 6: Derive the symmetric key
                            symmetricKey = new SymmetricKey(decryptedResults.plaintext);
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
    
            // Step 5: Handle errors if no symmetric key was found
            if (!symmetricKey) {
                console.error('No matching symmetric key found in the header.');
                throw new Error('Your key is not found in the header.');
            }
    
            // Step 6: Decrypt the message with the symmetric key
            const decryptedMessage = symmetricKey.decrypt(message) as number[];
            return decryptedMessage;
        } catch (error) {
            console.error(`Decryption failed: ${(error as Error).message}`);
            throw new Error(`Decryption failed: ${(error as Error).message}`);
        }
    }

    /**
     * Builds a message header containing recipient information.
     * 
     * @param senderPublicKey - The sender's public key in hex format.
     * @param recipients - An array of recipient public keys in hex format.
     * @param encryptedKeys - An array of objects containing encrypted symmetric keys.
     * @param currentVersion - The current header version number.
     * @returns The constructed header as an array of bytes.
     */
    buildHeader(
        senderPublicKey: string,
        recipients: string[],
        encryptedKeys: { ciphertext: number[] }[],
        currentVersion: number
    ): number[] {
        const writer = new Utils.Writer();
    
        // Helper function for validating a public key
        const validatePublicKey = (key: string): boolean => {
            return key.length === 66 && /^[0-9a-fA-F]+$/.test(key); // 66 hex chars = 33 bytes
        };
    
        // Step 1: Validate the sender's public key
        if (!validatePublicKey(senderPublicKey)) {
            throw new Error(`Invalid sender public key: ${senderPublicKey}`);
        }
    
        // Step 2: Increment the version and write it (4 bytes)
        const newVersion = currentVersion + 1; // Increment the passed-in version
        writer.writeUInt32LE(newVersion); // Write the incremented version
    
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
    
        // Step 5: Write each recipient's entry
        cleanedRecipients.forEach((recipient, i) => {
            const recipientPublicKey = Utils.toArray(recipient, 'hex');
            const senderPublicKeyBytes = Utils.toArray(senderPublicKey, 'hex');
            const encryptedKey = cleanedEncryptedKeys[i].ciphertext;
    
            // Write recipient's public key (33 bytes)
            writer.write(recipientPublicKey);
    
            // Write sender's public key (33 bytes)
            writer.write(senderPublicKeyBytes);
    
            // Write length of the encrypted symmetric key
            writer.writeVarIntNum(encryptedKey.length);
    
            // Write the encrypted symmetric key
            writer.write(encryptedKey);
        });

        // Step 6: Get the full header content
        const headerContent = writer.toArray();
    
        // Step 7: Prepend the length of the header
        const finalWriter = new Utils.Writer();
        finalWriter.writeVarIntNum(headerContent.length); // Prepend the length
        finalWriter.write(headerContent); // Append the full header content
    
        const fullHeader = finalWriter.toArray();
    
        return fullHeader;
    }

    /**
     * Parses a message header and extracts key information.
     * 
     * @param ciphertext - The ciphertext containing the header and message.
     * @returns An object containing the parsed header, and message.
     */
    parseHeader(ciphertext: number[]): { header: number[]; message: number[]; } {
        try {
            const reader = new Utils.Reader(ciphertext);

            // Step 1: Read and validate header length
            const headerLength = reader.readVarIntNum();

            if (headerLength > reader.bin.length - reader.pos) {
                throw new Error('Header length exceeds available data.');
            }
    
            const header = reader.read(headerLength);

            // Step 2: Parse the header content
            const tempReader = new Utils.Reader(header);
    
            // Step 3: Validate version
            const version = tempReader.readUInt32LE();
    
            if (version < 1) {
                throw new Error(`Unsupported or invalid header version: ${version}`);
            }
    
            // Step 4: Validate number of recipients
            const numRecipients = tempReader.readVarIntNum();

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

                // Read fixed-length sender key (33 bytes)
                const senderKey = tempReader.read(33);
                if (senderKey.length !== 33) {
                    console.warn(`Skipping malformed sender at index ${i}: invalid key length.`);
                    continue;
                }

                // Read and validate encrypted key
                const encryptedKeyLength = tempReader.readVarIntNum();
                const encryptedKey = tempReader.read(encryptedKeyLength);
    
                if (encryptedKey.length !== encryptedKeyLength) {
                    console.warn(`Skipping malformed entry at index ${i}: encrypted key length mismatch.`);
                    continue;
                }

                recipients.push({
                    recipientPublicKey: Utils.toHex(recipientKey),
                    senderPublicKey: Utils.toHex(senderKey),
                    encryptedKey: encryptedKey,
                });
            }

            // Step 6: Extract remaining message
            const remainingBytes = reader.bin.slice(reader.pos);
            const message = remainingBytes.length > 0 ? remainingBytes : [];

            return { header, message };
        } catch (error) {
            console.error(`Error Parsing Header: ${(error as Error).message}`);
            throw new Error('Failed to parse header or message.');
        }
    }

    /**
     * Adds a new participant to an existing message group.
     * 
     * @param iheader - The original message header as an array of bytes.
     * @param protocolID - The protocol ID defining cryptographic context.
     * @param keyID - A unique identifier for the key used.
     * @param newParticipant - The public key of the new participant in hex format.
     * @returns The updated message header as an array of bytes.
     */
    async addParticipant(
        iheader: number[],
        protocolID: WalletProtocol,
        keyID: string,
        newParticipant: string
    ): Promise<number[]> {
        try {
            // Step 1: Parse the header
            const { header, message } = this.parseHeader(iheader);
            const reader = new Utils.Reader(header);
    
            // Step 2: Read and validate the version
            const version = reader.readUInt32LE();

            if (version < 1) throw new Error(`Unsupported header version: ${version}`);
    
            // Step 3: Read the number of recipients
            const numRecipients = reader.readVarIntNum();

            if (numRecipients <= 0) throw new Error('No recipients found in the header.');
    
            const recipients: string[] = [];
            const encryptedKeys: { ciphertext: number[] }[] = [];
            let senderPublicKey: string | null = null;
            let symmetricKey: SymmetricKey | null = null;
    
            // Step 4: Parse recipient entries
            for (let i = 0; i < numRecipients; i++) {
                try {
                    // Read recipient public key
                    const recipientPublicKeyBytes = reader.read(33);
                    if (recipientPublicKeyBytes.length !== 33) {
                        console.warn(`Skipping malformed entry at index ${i}: Invalid recipient key length`);
                        continue;
                    }
                    const recipientPublicKey = Utils.toHex(recipientPublicKeyBytes);
    
                    // Read sender public key
                    const senderPublicKeyBytes = reader.read(33);
                    if (senderPublicKeyBytes.length !== 33) {
                        console.warn(`Skipping malformed entry at index ${i}: Invalid sender key length`);
                        continue;
                    }
                    senderPublicKey = Utils.toHex(senderPublicKeyBytes);
    
                    // Read and validate encrypted key
                    const encryptedKeyLength = reader.readVarIntNum();
                    const encryptedKey = reader.read(encryptedKeyLength);
                    if (encryptedKey.length !== encryptedKeyLength) {
                        console.warn(`Skipping malformed entry at index ${i}: Invalid encrypted key length`);
                        continue;
                    }
    
                    // Add to recipients and keys
                    recipients.push(recipientPublicKey);
                    encryptedKeys.push({ ciphertext: encryptedKey });
    
                    // Extract symmetric key for the first valid recipient
                    if (!symmetricKey) {
                        const decryptedResults = await this.wallet.decrypt({
                            protocolID,
                            keyID,
                            counterparty: senderPublicKey,
                            ciphertext: encryptedKey,
                        });
                        symmetricKey = new SymmetricKey(decryptedResults.plaintext);

                    }
                } catch (err) {
                    console.warn(`Error parsing recipient entry at index ${i}:`, err);
                    continue;
                }
            }
    
            if (!senderPublicKey) throw new Error('Sender public key not found in the header.');
    
            // Step 5: Ensure the new participant isn't already in the header
            if (recipients.includes(newParticipant)) {
                throw new Error(`Participant ${newParticipant} already exists in the header.`);
            }
    
            // Step 6: Encrypt the symmetric key for the new participant
            if (!symmetricKey) throw new Error('Symmetric key not found in the header.');
            const newEncryptedKey = await this.wallet.encrypt({
                protocolID,
                keyID,
                counterparty: newParticipant,
                plaintext: symmetricKey.toArray(),
            });

            recipients.push(newParticipant);
            encryptedKeys.push({ ciphertext: newEncryptedKey.ciphertext as number[] });

            // Step 6: Reconstruct the updated header
            const updatedHeader = this.buildHeader(senderPublicKey, recipients, encryptedKeys, version);

            return updatedHeader;
        } catch (error) {
            console.error(`Error adding participant: ${(error as Error).message}`);
            throw new Error('Failed to add new participant to the header.');
        }
    }

    /**
     * Removes a participant from the message group.
     * 
     * @param iheader - The original message header as an array of bytes.
     * @param targetParticipant - The public key of the participant to remove in hex format.
     * @returns The updated message header as an array of bytes.
     */
    async removeParticipant(iheader: number[], targetParticipant: string): Promise<number[]> {
        try {
            // Step 1: Parse the header
            const { header, message } = this.parseHeader(iheader);
            const reader = new Utils.Reader(header);
    
            // Step 2: Read and validate the version
            const version = reader.readUInt32LE();

            if (version < 1) {
                throw new Error(`Unsupported header version: ${version}`);
            }

            // Step 3: Read the number of recipients
            const numRecipients = reader.readVarIntNum();

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
                    const recipientPublicKey = Utils.toHex(recipientPublicKeyBytes);
    
                    // Read sender public key (fixed 33 bytes)
                    const senderPublicKeyBytes = reader.read(33);
                    if (senderPublicKeyBytes.length !== 33) {
                        console.warn(`Skipping malformed entry at index ${i}: Invalid sender key length`);
                        continue;
                    }
                    senderPublicKey = Utils.toHex(senderPublicKeyBytes);
    
                    // Read and validate encrypted key
                    const encryptedKeyLength = reader.readVarIntNum();
                    const encryptedKey = reader.read(encryptedKeyLength);
                    if (encryptedKey.length !== encryptedKeyLength) {
                        console.warn(`Skipping malformed entry at index ${i}: Invalid encrypted key length`);
                        continue;
                    }
    
                    // Check if this is the participant to exclude
                    if (recipientPublicKey !== targetParticipant) {
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
    
            // Step 5: Ensure the target participant was successfully removed
            if (recipients.includes(targetParticipant)) {
                throw new Error('Failed to remove participant from the header.');
            }
    
            // Step 6: Reconstruct the updated header
            const updatedHeader = this.buildHeader(senderPublicKey, recipients, encryptedKeys, version);

            return updatedHeader;
        } catch (error) {
            console.error(
                `Error removing participant: ${(error instanceof Error) ? error.message : error}`
            );
            throw new Error('Failed to remove participant.');
        }
    }
    
}
