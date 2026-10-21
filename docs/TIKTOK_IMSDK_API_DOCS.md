# Tài Liệu Kỹ Thuật: TikTok IMSDK Message Send API
> **Phiên bản tài liệu:** 1.0  
> **Nền tảng:** TikTok / Douyin Android IMSDK (App version: 47.1.4 / Build: 470104)  
> **Giao thức:** HTTPS POST / Protocol Buffers (Protobuf wire format)

---

## 1. Tổng quan Endpoint

* **URL:** `https://api22-normal-c-alisg.tiktokv.com/v1/message/send`
* **Method:** `POST`
* **Content-Type:** `application/x-protobuf`
* **Payload Type:** Dữ liệu nhị phân (`raw bytes` / `binary buffer`), không phải JSON thuần.

### Các Query Parameters chính trên URL:
| Param | Ý nghĩa | Ví dụ |
| :--- | :--- | :--- |
| `device_id` | Định danh thiết bị | `7697295515054884404` |
| `iid` | Install ID | `7697302584835147536` |
| `aid` | App ID (1180 = Trill / TikTok Global) | `1180` |
| `version_code` | Mã phiên bản app | `470104` |
| `app_name` | Tên gói app | `trill` |
| `ts` | Timestamp tính bằng giây (Epoch seconds) | `1792169696` |
| `_rticket` | Timestamp tính bằng mili-giây | `1792169696738` |

---

## 2. Các Headers Quan Trọng

### 2.1. Nhóm băm toàn vẹn dữ liệu (Bắt buộc)
* **`X-SS-STUB`**: **MD5 Hash viết hoa của toàn bộ Payload nhị phân Protobuf**
  $$\text{X-SS-STUB} = \text{MD5}(\text{body.bin}).\text{upper()}$$
  > *Lưu ý:* Khi thay đổi bất kỳ ký tự nào trong body (text, UUID), `X-SS-STUB` bắt buộc phải được tính toán lại tương ứng.

### 2.2. Nhóm xác thực & Phiên làm việc (Auth)
* **`X-Tt-Token`**: Chuỗi token xác thực người dùng chính của phiên (Token dài).
* **`Cookie`**: Bắt buộc chứa các cookies phiên, quan trọng nhất:
  * `sid_tt`: Session ID xác thực đăng nhập.
  * `uid_tt` / `uid_tt_ss`: Hash định danh tài khoản.
  * `multi_sids`: Định danh UID và Session tương ứng.
  * `d_ticket`: Device ticket.

### 2.3. Nhóm chữ ký bảo vệ chống can thiệp (Anti-Tamper Signatures)
* **`X-Gorgon`**: Chữ ký động tính từ URL params, X-SS-STUB, cookies và timestamp.
* **`X-Khronos`**: Timestamp Unix đi kèm của X-Gorgon.
* **`X-Argus`**: Token bảo mật mã hóa mức native của SecSDK (`libcms.so`).
* **`X-Ladon`**: Chữ ký phụ trợ chống replay.
* **`tt-ticket-guard-client-data`**: Chữ ký Ticket Guard bảo vệ request.

---

## 3. Cấu trúc Protobuf Payload (Request Body)

Payload khi được giải mã schema-less (dưới dạng các Field Tags):

```json
{
  "1": 100,
  "2": 550036,
  "5": 1,
  "6": 0,
  "8": {
    "100": {
      "1": "0:1:7074906265289769986:7257962282297721861",
      "2": 1,
      "3": 7562604882604212501,
      "4": "{\"text\":\"Hello bro\",\"reference_scene\":0,\"aweType\":700}",
      "5": [
        { "1": "a:entrance_type", "2": "1" },
        { "1": "a:process_id", "2": "776b2752-a2dc-431c-a97d-01284871b2c6" }
      ],
      "6": 7,
      "8": "805beee5-875e-4cc4-af2f-4cad4528f17d",
      "13": "",
      "14": "",
      "19": ""
    }
  },
  "9": "7697295515054884404",
  "10": "googleplay",
  "11": "android",
  "14": "470104",
  "15": [
    { "1": "iid", "2": "7697302584835147536" },
    { "1": "aid", "2": "1180" },
    { "1": "IMSDK-User-ID", "2": "7074906265289769986" }
  ],
  "18": 0,
  "21": ""
}
```

### Chi tiết các trường trong Block `"8" -> "100"`:

| Tag | Kiểu dữ liệu | Ý nghĩa | Mô tả chi tiết |
| :---: | :---: | :--- | :--- |
| **`1`** | `string` | **Conversation ID / Target ID** | Định danh cuộc trò chuyện: `0:1:{Sender_UID}:{Target_UID}`.<br>• `Sender_UID`: UID của bạn (`7074906265289769986`).<br>• `Target_UID`: **UID của người nhận tin nhắn** (`7257962282297721861`). |
| **`2`** | `int (VarInt)` | `conversation_type` | `1` = Chat trực tiếp 1-1 (Direct Message); `2` = Group Chat. |
| **`3`** | `int64 (VarInt)` | `client_sequence_id` | Số nguyên 64-bit client sinh ra. Giữ nguyên hoặc tăng dần. |
| **`4`** | `string` | **Message Content (JSON)** | Chuỗi JSON chứa nội dung tin nhắn:<br>`{"text":"<Nội dung>","reference_scene":0,"aweType":700}` |
| **`5`** | `repeated msg` | Metadata bổ trợ | Mảng metadata, trong đó chứa `a:process_id` (UUID v4 mới cho mỗi tiến trình gửi). |
| **`6`** | `int (VarInt)` | `message_type` | Loại tin nhắn (`7` = Text thông thường). |
| **`8`** | `string` | **`client_message_id`** | **Cực kỳ quan trọng:** Chuỗi UUID v4 duy nhất cho mỗi tin nhắn mới để chống gửi trùng. |

---

## 4. Các Phát Hiện & Bài Học Kỹ Thuật (Key Gotchas)

### 4.1. Cơ chế chống trùng tin nhắn (Deduplication / Idempotency)
* **Hiện tượng:** Gửi request thành công (`HTTP 200`, `b'OK'`) nhưng trên app không xuất hiện tin nhắn mới.
* **Nguyên nhân:** Gói tin bị trùng `client_message_id` (Field `"8"` trong block `"100"`). Nếu gửi lại UUID cũ mà máy đã gửi trước đó, server nhận diện là gói retry nên chỉ báo `OK` (xác nhận tin đã tồn tại) mà không chèn tin mới vào cơ sở dữ liệu.
* **Giải pháp:** Mỗi lần gửi tin nhắn mới, **bắt buộc phải sinh một UUID v4 ngẫu nhiên mới** cho trường `"8"` và `process_id`.

### 4.2. Lỗi `100017` (Signature Mismatch)
* **Hiện tượng:** Server trả về `{ '3': 100017, '4': b'100017' }`.
* **Nguyên nhân:** Khi bạn đổi nội dung tin nhắn làm `X-SS-STUB` thay đổi, nhưng lại gửi kèm các chữ ký cũ không tương thích, cơ chế bảo vệ của ByteDance sẽ phát hiện can thiệp và từ chối xử lý.
* **Giải pháp:** Nếu thay đổi cấu trúc quá sâu hoặc thay đổi sau một thời gian dài (timestamp hết hạn), cần cập nhật lại bộ chữ ký `X-Gorgon` / `X-Argus` từ Sign Server.

### 4.3. Bẫy kiểu dữ liệu VarInt 64-bit (Khi dùng `blackboxprotobuf`)
* Hàm `blackboxprotobuf.protobuf_to_json` sẽ tự ép kiểu các số nguyên 64-bit lớn (như ID `7562604882604212501`) thành chuỗi `string`.
* Nếu parse lại bằng `json.loads` rồi encode, hàm `encode_varint` sẽ bắn lỗi `TypeError: VarInt encode requires an int type`.
* **Chuẩn hóa:** Luôn dùng trực tiếp `decode_message(raw_bytes)` để dữ liệu giữ nguyên kiểu `int` trong Python.

---

## 5. Cấu trúc Response thành công từ Server

Khi một tin nhắn mới được chấp thuận và tạo thành công, server trả về:

```python
{
  '1': 100,
  '2': 550036,
  '3': 0,                       # Mã lỗi: 0 = Thành công
  '4': b'OK',                   # Thông điệp: OK
  '5': 0,
  '6': {
    '100': {
      '1': 7697314932641547784, # SERVER MESSAGE ID mới sinh ra
      '4': b'805beee5-875e...', # Khớp đúng client_message_id đã gửi
      '3': 0,
      '5': 0,
      '12': 1
    }
  },
  '7': b'20261017011312...',    # Log ID của server
  '10': 1792170793004,          # Server timestamp
  '14': b'Singapore-Central',   # Cụm IDC xử lý
  '15': 7074906265289769986     # UID của bạn
}
```

---

## 6. Khả năng tích hợp trên React Native / JavaScript

Hệ thống có thể chuyển sang React Native 100% bằng JavaScript thuần:
1. **Protobuf Wire Encoder:** Viết bằng ~40 dòng JS thuần (xử lý `BigInt` và `Uint8Array`).
2. **MD5 Stub:** Dùng `crypto-js` trên mảng `Uint8Array`.
3. **HTTP Fetch:** Dùng trực tiếp `fetch(url, { method: 'POST', body: uint8Array })`.

---

## 7. Phương pháp 1: Trích xuất Session từ App Android nội bộ (ADB Root)

TikTok lưu trữ dữ liệu xác thực bên trong Sandbox của app tại `/data/data/com.ss.android.ugc.trill/`:

### 7.1. Cấu trúc lưu trữ:
1. **ByteDance Keva Storage Engine:**
   * **Đường dẫn:** `/data/data/com.ss.android.ugc.trill/files/keva/repo/token_shared_preference/token_shared_preference.blk`
   * **Dữ liệu:** `X-Tt-Token` (dài 365 ký tự), `User ID (UID)`, và `ts_sign`.
2. **TTNet Cookie Store:**
   * **Đường dẫn:** `/data/data/com.ss.android.ugc.trill/shared_prefs/ttnetCookieStore.xml`
   * **Định dạng:** Đối tượng Java Serialized (dạng Hex chuỗi ASCII). Chứa các cookie `sessionid`, `sid_tt`, `uid_tt`, `d_ticket`, `multi_sids`, v.v.

---

## 8. Phương pháp 2: Trích xuất & Giải mã Cookies từ In-App WebView

Đây là giải pháp hoạt động được trên máy thật không cần quyền Root, cho phép người dùng đăng nhập tài khoản chính thức qua WebView và app tự động bóc tách token.

### 8.1. Cơ chế lưu trữ của Chromium / WebView2:
Khi nhúng WebView trên Desktop hoặc Android:
* Toàn bộ cookies được lưu vào cơ sở dữ liệu SQLite tại:  
  `EBWebView/Default/Network/Cookies`
* Master Key dùng để mã hóa cookies được lưu tại:  
  `EBWebView/Local State` (Dưới trường `os_crypt.encrypted_key`)

### 8.2. Quy trình Giải mã Cookies Chromium (DPAPI + AES-256-GCM):

```text
[ Local State ]
      │
      ▼ (Lấy chuỗi Base64: os_crypt.encrypted_key)
[ Bỏ tiền tố 5 bytes 'DPAPI' ]
      │
      ▼ (Gọi Windows CryptUnprotectData - DPAPI)
[ Master Key (32 bytes AES) ]
      │
      ├─────────────────────────────────────────────────┐
      ▼                                                 ▼
[ SQLite: Cookies ]                             [ Giải mã AES-GCM ]
  - host_key: .tiktok.com                         - Nonce: 12 bytes (offset 3..15)
  - name: sessionid                               - Ciphertext + Tag: (offset 15..)
  - encrypted_value: v10 / v11 ...                - Key: Master Key
                                                        │
                                                        ▼
                                                [ Plaintext Cookie ]
                                                (Strip binding header '>S')
                                                        │
                                                        ▼
                                       sessionid = 92b7806530161c819926ae...
```

### 8.3. Chi tiết thuật toán giải mã bằng Python:
1. **Bước 1 - Lấy Master Key:**
   * Đọc file `Local State`, trích xuất `encrypted_key` (Base64).
   * Cắt bỏ 5 bytes đầu (`b'DPAPI'`).
   * Sử dụng Windows API `CryptUnprotectData` (từ thư viện `crypt32.dll`) để giải mã ra chuỗi khóa 32 bytes AES.
2. **Bước 2 - Đọc SQLite Database:**
   * Copy file `Cookies` ra một file tạm (tránh bị hệ điều hành khóa file khi WebView đang chạy).
   * Truy vấn SQL: `SELECT name, encrypted_value FROM cookies WHERE host_key LIKE '%tiktok.com%'`.
3. **Bước 3 - Giải mã AES-256-GCM:**
   * Kiểm tra tiền tố 3 bytes: `b'v10'` hoặc `b'v11'`.
   * Lấy **Nonce (IV)**: 12 bytes từ vị trí `3` đến `15`.
   * Lấy **Ciphertext & Tag**: Toàn bộ bytes từ vị trí `15` trở về sau.
   * Dùng `AESGCM(master_key).decrypt(nonce, ciphertext_and_tag, None)` để giải mã.
4. **Bước 4 - Chuẩn hóa tiền tố (Chromium v127+ App-Bound Header):**
   * Chromium phiên bản mới tự động chèn tiền tố binding (ký tự `>S` hoặc SHA256 header) vào trước chuỗi văn bản.
   * Loại bỏ tiền tố này để thu được chuỗi token sạch:
     * `sessionid`: Chuỗi Hex 32 ký tự (Ví dụ: `92b7806530161c819926ae61af4dd2fa`).
     * `sid_tt`: Giá trị đồng bộ với sessionid.
     * `uid_tt`: Chuỗi hash User ID.

### 8.4. Áp dụng tương đương trên React Native (Mobile Thật):
Trên thiết bị thật (React Native), hệ điều hành Android cung cấp sẵn `CookieManager` quản lý trực tiếp trong bộ nhớ RAM, bạn không cần phải tự giải mã SQLite:
```javascript
// Đọc trực tiếp cookies từ WebView trong React Native:
import CookieManager from '@react-native-cookies/cookies';

const cookies = await CookieManager.get('https://www.tiktok.com');
const sessionid = cookies.sessionid?.value;
const sid_tt = cookies.sid_tt?.value;
```
Mọi cờ bảo mật `HttpOnly` đều được trích xuất nguyên vẹn cho ứng dụng của bạn.

