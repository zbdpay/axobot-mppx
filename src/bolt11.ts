const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function decodeBech32Words(value: string): number[] {
  const words: number[] = [];
  for (const character of value) {
    const index = BECH32_CHARSET.indexOf(character);
    if (index < 0) {
      throw new Error("Invalid bech32 character");
    }
    words.push(index);
  }
  return words;
}

function wordsToBytes(words: number[]): Uint8Array {
  let bitBuffer = 0;
  let bitCount = 0;
  const bytes: number[] = [];

  for (const word of words) {
    bitBuffer = (bitBuffer << 5) | word;
    bitCount += 5;

    while (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bitBuffer >> bitCount) & 0xff);
    }
  }

  return Uint8Array.from(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function extractPaymentHashFromBolt11(rawInvoice: string): string | null {
  const invoice = rawInvoice.toLowerCase().startsWith("lightning:")
    ? rawInvoice.slice("lightning:".length)
    : rawInvoice;

  const normalized = invoice.toLowerCase();
  const separatorIndex = normalized.lastIndexOf("1");
  if (separatorIndex <= 0 || separatorIndex >= normalized.length - 7) {
    return null;
  }

  const dataAndChecksum = normalized.slice(separatorIndex + 1);
  if (dataAndChecksum.length <= 6) {
    return null;
  }

  const payloadWords = decodeBech32Words(dataAndChecksum.slice(0, -6));
  if (payloadWords.length <= 7 + 104) {
    return null;
  }

  let index = 7;
  while (index + 3 <= payloadWords.length - 104) {
    const tagValue = payloadWords[index];
    const lengthHigh = payloadWords[index + 1];
    const lengthLow = payloadWords[index + 2];
    if (
      typeof tagValue !== "number" ||
      typeof lengthHigh !== "number" ||
      typeof lengthLow !== "number"
    ) {
      return null;
    }

    const length = (lengthHigh << 5) + lengthLow;
    index += 3;

    if (length < 0 || index + length > payloadWords.length - 104) {
      return null;
    }

    const tag = BECH32_CHARSET[tagValue] ?? "";
    const words = payloadWords.slice(index, index + length);
    index += length;

    if (tag === "p") {
      const bytes = wordsToBytes(words);
      if (bytes.length >= 32) {
        return bytesToHex(bytes.slice(0, 32));
      }
      return null;
    }
  }

  return null;
}
