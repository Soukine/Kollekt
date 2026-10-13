import QRCode from 'qrcode';

export async function generateQrDataUrl(
  text: string,
  options?: {
    colorDark?: string;
    colorLight?: string;
    width?: number;
    margin?: number;
  }
): Promise<string> {
  const opts = {
    errorCorrectionLevel: 'M' as const,
    margin: options?.margin ?? 2,
    width: options?.width ?? 280,
    color: {
      dark: options?.colorDark ?? '#211D1A',
      light: options?.colorLight ?? '#FFFFFF',
    },
  };

  try {
    return await QRCode.toDataURL(text, opts);
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
}
