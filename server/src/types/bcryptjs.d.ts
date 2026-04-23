// Manual type declarations for bcryptjs@2.x
// (The @types/bcryptjs@3 stub incorrectly claims bcryptjs bundles its own types)
declare module 'bcryptjs' {
  export function hash(data: string, saltOrRounds: string | number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
  export function hashSync(data: string, saltOrRounds: string | number): string;
  export function compareSync(data: string, encrypted: string): boolean;
  export function genSalt(rounds?: number): Promise<string>;
  export function genSaltSync(rounds?: number): string;
  export function getRounds(hash: string): number;
  export default {
    hash,
    compare,
    hashSync,
    compareSync,
    genSalt,
    genSaltSync,
    getRounds,
  };
}
