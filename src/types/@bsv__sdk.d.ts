declare module '@bsv/sdk' {
    export class Wallet {
    }
}

declare module '@bsv/sdk/dist/primitives/SymmetricKey.js' {
    export default class SymmetricKey {
        static fromRandom(): SymmetricKey;
        encrypt(message: number[]): number[];
        decrypt(message: number[]): number[];
        toArray(): number[];
    }
}

declare module '@bsv/sdk/dist/primitives/utils.js' {
    export class Writer {
        writeVarIntNum(length: number): Writer;
        write(buffer: number[]): Writer;
        toArray(): number[];
    }
}

