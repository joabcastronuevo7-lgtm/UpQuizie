// Ambient declaration for pdf-parse (ships no types).
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PDFData {
    text: string;
    numpages: number;
    info: unknown;
  }
  function pdf(dataBuffer: Buffer): Promise<PDFData>;
  export default pdf;
}
