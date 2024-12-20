# API

Links: [API](#api), [Classes](#classes)

## Classes

### Class: CurvePoint

```ts
export class CurvePoint {
    constructor(wallet: Wallet) 
    async encrypt(message: number[], protocolID: WalletProtocol, keyID: string, recipients: string[], administrators?: string[]): Promise<{
        encryptedMessage: number[];
        header: number[];
    }> 
    async decrypt(ciphertext: number[], protocolID: WalletProtocol, keyID: string): Promise<number[]> 
    buildHeader(senderPublicKey: string, recipients: string[], encryptedKeys: {
        ciphertext: number[];
    }[], administrators: string[], currentVersion: number): number[] 
    parseHeader(ciphertext: number[]): {
        header: number[];
        message: number[];
        administrators: string[];
    } 
    async addParticipant(iheader: number[], protocolID: WalletProtocol, keyID: string, newParticipant: string): Promise<number[]> 
    async removeParticipant(iheader: number[], targetParticipant: string): Promise<number[]> 
}
```

<details>

<summary>Class CurvePoint Details</summary>

#### Constructor

Initializes a new CurvePoint instance.

```ts
constructor(wallet: Wallet) 
```

Argument Details

+ **wallet**
  + The wallet instance providing cryptographic operations.

#### Method addParticipant

Adds a new participant to an existing message group.

```ts
async addParticipant(iheader: number[], protocolID: WalletProtocol, keyID: string, newParticipant: string): Promise<number[]> 
```

Returns

The updated message header as an array of bytes.

Argument Details

+ **iheader**
  + The original message header as an array of bytes.
+ **protocolID**
  + The protocol ID defining cryptographic context.
+ **keyID**
  + A unique identifier for the key used.
+ **newParticipant**
  + The public key of the new participant in hex format.

#### Method buildHeader

Builds a message header containing recipient and administrator information.

```ts
buildHeader(senderPublicKey: string, recipients: string[], encryptedKeys: {
    ciphertext: number[];
}[], administrators: string[], currentVersion: number): number[] 
```

Returns

The constructed header as an array of bytes.

Argument Details

+ **senderPublicKey**
  + The sender's public key in hex format.
+ **recipients**
  + An array of recipient public keys in hex format.
+ **encryptedKeys**
  + An array of objects containing encrypted symmetric keys.
+ **administrators**
  + An array of administrator public keys in hex format.
+ **currentVersion**
  + The current header version number.

#### Method decrypt

Decrypts a message intended for the recipient.

```ts
async decrypt(ciphertext: number[], protocolID: WalletProtocol, keyID: string): Promise<number[]> 
```

Returns

The decrypted message as an array of bytes.

Argument Details

+ **ciphertext**
  + The ciphertext containing the message header and encrypted message.
+ **protocolID**
  + The protocol ID defining cryptographic context.
+ **keyID**
  + A unique identifier for the key used.

#### Method encrypt

Encrypts a message for a group of recipients.

```ts
async encrypt(message: number[], protocolID: WalletProtocol, keyID: string, recipients: string[], administrators?: string[]): Promise<{
    encryptedMessage: number[];
    header: number[];
}> 
```

Returns

An object containing the encrypted message and the message header.

Argument Details

+ **message**
  + The plaintext message to encrypt as an array of bytes.
+ **protocolID**
  + The protocol ID defining cryptographic context.
+ **keyID**
  + A unique identifier for the key used.
+ **recipients**
  + An array of recipient public keys in hex format.
+ **administrators**
  + (Optional) An array of administrator public keys.

#### Method parseHeader

Parses a message header and extracts key information.

```ts
parseHeader(ciphertext: number[]): {
    header: number[];
    message: number[];
    administrators: string[];
} 
```

Returns

An object containing the parsed header, message, and administrator list.

Argument Details

+ **ciphertext**
  + The ciphertext containing the header and message.

#### Method removeParticipant

Removes a participant from the message group.
Only administrators are authorized to perform this action.

```ts
async removeParticipant(iheader: number[], targetParticipant: string): Promise<number[]> 
```

Returns

The updated message header as an array of bytes.

Argument Details

+ **iheader**
  + The original message header as an array of bytes.
+ **targetParticipant**
  + The public key of the participant to remove in hex format.

</details>

Links: [API](#api), [Classes](#classes)

---
