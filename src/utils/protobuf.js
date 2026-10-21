/**
 * Thuần JavaScript Protobuf Encoder & Decoder
 * Chuyển giao từ logic python (encode_payload.py & blackboxprotobuf)
 * Tương thích 100% với React Native và ByteDance IMSDK
 */

export function encodeVarint(val) {
  let num = typeof val === 'bigint' ? val : BigInt(val);
  if (num < 0n) {
    num += 1n << 64n;
  }
  const bytes = [];
  while (true) {
    const b = Number(num & 0x7fn);
    num >>= 7n;
    if (num !== 0n) {
      bytes.push(b | 0x80);
    } else {
      bytes.push(b);
      break;
    }
  }
  return new Uint8Array(bytes);
}

export function encodeField(fieldNum, wireType, dataBytes) {
  const tag = (BigInt(fieldNum) << 3n) | BigInt(wireType);
  const tagBytes = encodeVarint(tag);
  const res = new Uint8Array(tagBytes.length + dataBytes.length);
  res.set(tagBytes, 0);
  res.set(dataBytes, tagBytes.length);
  return res;
}

export function encodeVarintField(fieldNum, val) {
  return encodeField(fieldNum, 0, encodeVarint(val));
}

export function encodeLengthDelimited(fieldNum, dataBytes) {
  const lenBytes = encodeVarint(dataBytes.length);
  const combined = new Uint8Array(lenBytes.length + dataBytes.length);
  combined.set(lenBytes, 0);
  combined.set(dataBytes, lenBytes.length);
  return encodeField(fieldNum, 2, combined);
}

export function encodeStringField(fieldNum, strVal) {
  const utf8Bytes = new TextEncoder().encode(strVal);
  return encodeLengthDelimited(fieldNum, utf8Bytes);
}

export function concatArrays(arrays) {
  const totalLength = arrays.reduce((acc, curr) => acc + curr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Mã hóa dictionary lồng nhau thành Protobuf binary bytes
 */
export function encodeObj(obj) {
  const chunks = [];
  const sortedKeys = Object.keys(obj).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  for (const k of sortedKeys) {
    const fn = parseInt(k, 10);
    const v = obj[k];

    if (typeof v === 'boolean') {
      chunks.push(encodeVarintField(fn, v ? 1 : 0));
    } else if (typeof v === 'number' || typeof v === 'bigint') {
      chunks.push(encodeVarintField(fn, v));
    } else if (typeof v === 'string') {
      chunks.push(encodeStringField(fn, v));
    } else if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'object' && item !== null) {
          chunks.push(encodeLengthDelimited(fn, encodeObj(item)));
        } else if (typeof item === 'string') {
          chunks.push(encodeStringField(fn, item));
        } else if (typeof item === 'number' || typeof item === 'bigint') {
          chunks.push(encodeVarintField(fn, item));
        }
      }
    } else if (typeof v === 'object' && v !== null) {
      chunks.push(encodeLengthDelimited(fn, encodeObj(v)));
    }
  }

  return concatArrays(chunks);
}

/**
 * Kiểm tra xem chuỗi bytes có phải là văn bản UTF-8 in được (Printable String) hay không.
 * Nếu là văn bản (như Conversation ID "0:1:7074...", JSON, tên, số), giữ nguyên dạng String!
 * Tránh lỗi nhận nhầm ký tự ASCII ':' (0x3A = field 7) thành nested Protobuf message.
 */
function isPrintableText(bytes) {
  if (bytes.length === 0) return true;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
        return false;
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Trình giải mã Protobuf schema-less nhẹ (Lightweight Schema-less Protobuf Parser)
 */
export function decodeProtobuf(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let pos = 0;
  const result = {};

  const readVarint = () => {
    let res = 0n;
    let shift = 0n;
    while (pos < bytes.length) {
      const b = BigInt(bytes[pos++]);
      res |= (b & 0x7fn) << shift;
      if ((b & 0x80n) === 0n) break;
      shift += 7n;
    }
    return res;
  };

  while (pos < bytes.length) {
    const tag = readVarint();
    const fieldNum = Number(tag >> 3n);
    const wireType = Number(tag & 7n);

    if (wireType === 0) {
      const val = readVarint();
      const valNumber = val <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(val) : val.toString();
      addOrAppend(result, String(fieldNum), valNumber);
    } else if (wireType === 2) {
      const len = Number(readVarint());
      const subBytes = bytes.subarray(pos, pos + len);
      pos += len;

      if (isPrintableText(subBytes)) {
        // Là chuỗi text UTF-8 hợp lệ (VD: Conversation ID, text JSON)
        const str = new TextDecoder('utf-8').decode(subBytes);
        addOrAppend(result, String(fieldNum), str);
      } else {
        // Thử giải mã nested message Protobuf
        let parsedSub = null;
        try {
          if (subBytes.length > 0) {
            parsedSub = decodeProtobuf(subBytes);
            if (Object.keys(parsedSub).length === 0) parsedSub = null;
          }
        } catch (e) {
          parsedSub = null;
        }

        if (parsedSub) {
          addOrAppend(result, String(fieldNum), parsedSub);
        } else {
          addOrAppend(result, String(fieldNum), subBytes);
        }
      }
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }
  }

  return result;
}

function addOrAppend(obj, key, val) {
  if (key in obj) {
    if (Array.isArray(obj[key])) {
      obj[key].push(val);
    } else {
      obj[key] = [obj[key], val];
    }
  } else {
    obj[key] = val;
  }
}
