import PDFParser from 'pdf2json';

export interface ExtractedPdfResult {
  text: string;
  totalPages: number;
}

/**
 * Extracts text from a PDF Buffer using pdf2json (Pure JS, no external worker thread required)
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<ExtractedPdfResult> {
  return new Promise((resolve, reject) => {
    try {
      const pdfParser = new (PDFParser as any)(null, 1);

      pdfParser.on('pdfParser_dataError', (errData: any) => {
        const errorMsg = errData?.parserError || errData?.message || 'Erro ao processar PDF';
        reject(new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)));
      });

      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          let fullText = '';
          const pages = pdfData?.Pages || [];
          const totalPages = pages.length || 1;

          for (const page of pages) {
            let lastY = -1;
            let pageLines: string[] = [];
            let currentLine = '';

            const texts = page.Texts || [];
            for (const textItem of texts) {
              const decodedStr = (textItem.R || [])
                .map((r: any) => {
                  try {
                    return decodeURIComponent(r.T || '');
                  } catch {
                    return r.T || '';
                  }
                })
                .join('');

              // If Y changed significantly (> 0.4 units), start a new line
              if (lastY !== -1 && Math.abs(textItem.y - lastY) > 0.4) {
                if (currentLine.trim()) {
                  pageLines.push(currentLine.trim());
                }
                currentLine = decodedStr;
              } else {
                currentLine += (currentLine ? ' ' : '') + decodedStr;
              }
              lastY = textItem.y;
            }

            if (currentLine.trim()) {
              pageLines.push(currentLine.trim());
            }

            fullText += pageLines.join('\n') + '\n\n';
          }

          if (!fullText.trim()) {
            fullText = pdfParser.getRawTextContent() || '';
          }

          resolve({
            text: fullText,
            totalPages,
          });
        } catch (e: any) {
          resolve({
            text: pdfParser.getRawTextContent() || '',
            totalPages: pdfData?.Pages?.length || 1,
          });
        }
      });

      pdfParser.parseBuffer(buffer);
    } catch (err) {
      reject(err);
    }
  });
}
