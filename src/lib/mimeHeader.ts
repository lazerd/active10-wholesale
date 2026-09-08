/**
 * RFC 2047 encoded-words for MIME headers.
 *
 * WHY THIS EXISTS: a MIME body part declares its own charset
 * (`Content-Type: text/plain; charset="UTF-8"`), so an em dash in the BODY
 * arrives intact. A header has no charset to declare — RFC 5322 headers are
 * 7-bit ASCII, full stop. Putting raw UTF-8 bytes in `Subject:` leaves the
 * receiving client guessing, and clients guess latin-1, so
 *
 *     Active 10 — samples for Valley Spine & Health?
 *
 * arrives as `Active 10 Ã¢Â€Â" samples for ...` — the em dash's three UTF-8
 * bytes read as three latin-1 characters, then re-encoded on the way to the
 * screen. That went out to nine chiropractors on 2026-09-08 before the batch
 * was killed. Every subject with a dash, a curly quote, or an accent hits it.
 *
 * Encode the whole header value as one or more base64 encoded-words when it
 * contains anything non-ASCII, and leave pure-ASCII subjects untouched so the
 * common case stays human-readable on the wire.
 */

/**
 * An encoded-word must be <= 75 chars INCLUDING the `=?UTF-8?B?` prefix and
 * `?=` suffix (12 chars), leaving 63 for base64. Base64 only emits whole
 * 4-char groups, so round down to 60 chars of base64 = 45 bytes of input.
 */
const MAX_BYTES_PER_WORD = 45;

/**
 * Split UTF-8 bytes into chunks of at most MAX_BYTES_PER_WORD, never cutting a
 * multi-byte character in half. RFC 2047 requires each encoded-word to decode
 * on its own, so a chunk boundary landing mid-character would corrupt exactly
 * the characters this function exists to protect.
 */
function chunkByCharacter(value: string): Buffer[] {
  const chunks: Buffer[] = [];
  let current: Buffer[] = [];
  let size = 0;

  // Iterating the string yields whole code points (surrogate pairs included),
  // so an emoji or a CJK character is never split.
  for (const char of value) {
    const bytes = Buffer.from(char, "utf8");
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
 * Encode a header value for safe transmission. Pure ASCII passes through
 * unchanged; anything else comes back as RFC 2047 encoded-words folded onto
 * continuation lines.
 */
export function encodeMimeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (!/[^\x00-\x7F]/.test(value)) return value;
  return chunkByCharacter(value)
    .map((chunk) => `=?UTF-8?B?${chunk.toString("base64")}?=`)
    // Continuation lines are joined by CRLF + a space, which is how a header
    // wraps. Adjacent encoded-words separated only by whitespace are
    // concatenated with the whitespace dropped, so no stray spaces appear.
    .join("\r\n ");
}
