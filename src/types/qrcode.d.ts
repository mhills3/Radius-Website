// qrcode ships no bundled types and @types/qrcode isn't installed — declare just what we use.
declare module "qrcode" {
  interface QROptions {
    type?: "svg" | "utf8" | "terminal";
    margin?: number;
    width?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    color?: { dark?: string; light?: string };
  }
  export function toString(text: string, options?: QROptions): Promise<string>;
  const _default: { toString: typeof toString };
  export default _default;
}
