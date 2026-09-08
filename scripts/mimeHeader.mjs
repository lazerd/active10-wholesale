/**
 * RFC 2047 encoded-words for MIME headers — the .mjs twin of
 * src/lib/mimeHeader.ts, so standalone scripts share the same encoder.
 *
 * WHY: a MIME body part declares its own charset, so an em dash in the BODY
 * survives. A header has no charset to declare — RFC 5322 headers are 7-bit
 * ASCII. Raw UTF-8 in `Subject:` leaves the client guessing, and clients guess
 * latin-1, so
 *
 *     Active 10 — samples for Valley Spine & Health?
 *
 * arrived as `Active 10 Ã¢Â€Â" samples for ...` for the nine chiropractors
 * mailed on 2026-09-08 before the batch was stopped.
 */

/**
 * An encoded-word must be <= 75 chars including the 12-char `=?UTF-8?B?...?=`
 * wrapper, leaving 63 for base64; base64 emits whole 4-char groups, so 60
 * chars = 45 input bytes.
 */
const MAX_BYTES_PER_WORD = 45;

/**
 * Split into <=45-byte chunks without cutting a multi-byte character. Each
 * encoded-word must decode on its own, so a boundary landing mid-character
 * would corrupt exactly the characters this exists to protect. Iterating a
 * string yields whole code points, so surrogate pairs stay intact.
 */
function chunkByCharacter(value) {
  const chunks = [];
  let current = [];
  let size = 0;
  for (const char of value) {
    const bytes = Buffer.from(char, 'utf8');
    if (size + bytes.length > MAX_BYTES_PER_WORD && size > 0) {
      chunks.push(Buffer.concat(current));
      current = [];
      size = 0;
    }
    current.push(bytes);
    size += bytes.length;
  }
  if (size > 0) chunks.push(Buffer.concat(current));
  return chunks;
}

/**
 * Encode a header value. Pure ASCII passes through unchanged so the common
 * case stays readable on the wire.
 *
 * Adjacent encoded-words are joined with CRLF + space: that is a folded header
 * line, and a decoder drops the whitespace between two encoded-words, so the
 * subject reassembles with no stray spaces.
 */
export function encodeMimeHeader(value) {
  if (![...value].some((c) => c.codePointAt(0) > 127)) return value;
  const fold = '\r\n ';
  return chunkByCharacter(value)
    .map((chunk) => '=?UTF-8?B?' + chunk.toString('base64') + '?=')
    .join(fold);
}
