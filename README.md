# TikTokToe - TikTok Automation & IMSDK Management Suite

> Du an Vibe Coding With Antigravity (Powered by Google DeepMind Agentic AI)

TikTokToe la mot ung dung di dong hoan chinh duoc phat trien tren nen tang React Native va Expo, dong goi toan bo quy trinh Reverse-Engineering he thong TikTok IMSDK (Instant Messaging SDK) va Web Social API thanh mot he sinh thai quan ly hoi thoai, tu dong hoa gui tin nhan va ho tro giu chuoi tuong tac thong minh.

Du an duoc xay dung theo phuong phap Vibe Coding ket hop cung Antigravity - tro ly lap trinh AI the he moi cua Google DeepMind, the hien kha nang dong sang tao kien truc, giai ma giao thuc nhi phan va thiet ke he thong tu tang thap den tang cao voi toc do va do hoan thien vuot troi.

---

## 1. Tong Quan Kien Truc & Phuong Phap Vibe Coding

Mo hinh Vibe Coding voi Antigravity giup ket noi truc tiep giua y tuong phan tich mang he thong va ma nguon thuc thi:
- Giai ma giao thuc mang goc: Chuyen hoa truc tiep cac goi tin Protocol Buffers va chu ky bao mat (X-Bogus, X-SS-STUB) tu moi truong nghien cuu Python sang JavaScript va Kotlin thuan.
- Kien truc da lop (Multi-Tier Architecture): Ket hop chat che giua tang React Native UI, tang Native Module Kotlin (Android Foreground Service, AlarmManager, Headless JS), va tang API Services huong su kien.
- Kha nang chong tat tien trinh (Process Survivability): Ung dung duy tri tac vu hen gio chinh xac ngay ca khi thiet bi tat man hinh, toi uu hoa pin, hoac sau khi khoi dong lai he thong thong qua BootReceiver.

---

## 2. Cac Tinh Nang Trong Tam

### 2.1. Xac Thuc & Quan Ly Phien Lam Viec (Session Management)
- Tich hop WebView dang nhap chinh thuc cua TikTok, tu dong lang nghe va trich xuat toan bo cookies quan trong: `sessionid`, `sid_tt`, `multi_sids`, `ttwid`, `uid_tt`.
- Co che BackgroundTokenRefresher: Chay ngam WebView vo hinh giup duy tri phien dang nhap (heartbeat) va lam moi `msToken` dinh ky ma khong lam gian doan trai nghiem nguoi dung.

### 2.2. Dong Bo Tin Nhan & Danh Ba IMSDK
- Ket noi truc tiep toi endpoint IMSDK `/v2/message/get_by_user_init` su dung dinh dang nhi phan Protocol Buffers.
- Tu dong dong bo danh ba, anh dai dien (avatar), biet danh (nickname), username tu Social Spotlight API va Profile API.
- Hien thi danh sach hoi thoai voi so tin chua doc, tin nhan cuoi cung va thoi gian thuc.

### 2.3. Co Che Tu Dong Gui Tin & Chong Spam (Automation Engine)
- Ho tro gui tin nhan don le hoac gui hang loat theo chu ky.
- Che do An toan (Safe Mode): Mac dinh gioi han so luong tin va khoang cach toi thieu 5 giay giua cac lan gui de bao ve tai khoan khoi bo loc cua TikTok.
- Che do Mo khoa Toc do (Unlocked Mode): Co xac nhan canh bao rui ro bao mat, cho phep cau hinh linh hoat voi cac tham so tu do.
- Tu dong them ma so thu tu hoac ky tu ngau nhien de chong trung lap noi dung tin nhan.
- Co che tu dong ngat khan cap khi phat hien ma loi han che tu may chu TikTok.

### 2.4. Tu Dong Giu Chuoi Hang Ngay (Daily Streak Automation)
- Tich hop truc tiep voi Android AlarmManager thong qua native module, dat gio gui chinh xac theo chu ky 24 gio.
- Su dung Headless JS Task chay ngam khi ung dung da tat hoan toan.
- Tu dong khoi phuc lich trinh gui tin sau khi dien thoai khoi dong lai nho vao Android BootReceiver.

### 2.5. Tich Hop Tri Tue Nhan Tao Google Gemini
- Ho tro tao noi dung tin nhan giu chuoi tu dong bang Google Gemini API (gemini-2.5-flash, gemini-1.5-flash, ...).
- Nhieu phong cach van phong: Hai huoc, am ap, tho ca, than mat, ngan gon.
- Co che tin nhan du phong noi bo (fallback) khi mat ket noi mang hoac loi API key.

### 2.6. Trinh Tai Video TikTok Khong Logo (HD Video Downloader)
- Trich xuat va tai video do phan giai cao (HD No-Watermark) tu link TikTok Web hoac Short Link (vt.tiktok.com).
- Ho tro tach rieng va luu file am thanh MP3 chat luong goc.
- Tich hop tien trinh tai thuc te, cho phep mo file hoac chia se truc tiep len he thong.

### 2.7. He Thong Giao Dien & Che Do Nha Phat Trien
- Ho tro day du Dark Mode va Light Mode dong bo theo ngon ngu thiet ke chuan cua ung dung TikTok.
- Che do Nha phat trien (Dev Mode): He thong ghi log thoi gian thuc, hien thi chi tiet loi mang, request headers va debug console.

---

## 3. Cau Truc Thu Muc Du An

```text
tiktok_auto_app/
├── android/                          # Du an Native Android da cau hinh
│   └── app/src/main/
│       ├── AndroidManifest.xml       # Khai bao Foreground Service, Alarm, Boot Receiver
│       └── java/com/fatpro/tiktoktoe/
│           ├── MainActivity.kt
│           ├── MainApplication.kt    # Dang ky BackgroundServicePackage
│           ├── TikTokBackgroundModule.kt # Native module giao tiep React Native
│           ├── TikTokForegroundService.kt # Service giu tien trinh song ngam
│           ├── StreakAlarmReceiver.kt # BroadcastReceiver kich hoat chuong bao thuc
│           ├── StreakHeadlessService.kt # Khoi chay React Native Headless JS
│           ├── BootReceiver.kt       # Phuc hoi lich hen sau reboot
│           └── BackgroundServicePackage.kt
├── assets/                           # Icon, Splash Screen, Branding assets
├── src/
│   ├── components/                   # UI Components tai su dung
│   │   ├── BottomNavBar.js
│   │   ├── BackgroundTokenRefresher.js
│   │   ├── DangerSecurityModal.js
│   │   └── index.js
│   ├── constants/                    # Cau hinh, Theme, Session mac dinh
│   │   ├── theme.js
│   │   ├── ThemeContext.js
│   │   ├── initialSession.js
│   │   ├── realAppSession.js
│   │   └── index.js
│   ├── screens/                      # Cac man hinh chinh cua ung dung
│   │   ├── HomeScreen.js
│   │   ├── ConversationListScreen.js
│   │   ├── ChatDetailScreen.js
│   │   ├── VideoDownloaderScreen.js
│   │   ├── SettingsScreen.js
│   │   ├── LoginWebViewScreen.js
│   │   └── index.js
│   ├── services/                     # Business Logic & External APIs
│   │   ├── tiktokApi.js              # Reverse-engineered IMSDK & Web Social API
│   │   ├── scheduleWorker.js         # Quan ly hang doi va hen gio gui tin
│   │   ├── headlessStreakTask.js     # Tac vu Headless JS chay ngam Android
│   │   ├── geminiService.js          # Google Gemini AI content generator
│   │   ├── tiktokDownloaderService.js # Video extractor & downloader
│   │   ├── nativeBackgroundService.js # Bridge goi xuong tang Kotlin Android
│   │   ├── debugLoggerService.js     # He thong log chan doan he thong
│   │   └── index.js
│   └── utils/                        # Thuat toan ma hoa & tien ich
│       ├── protobuf.js               # Pure JavaScript binary Protobuf parser
│       ├── signXbogus.js             # X-Bogus URL signer
│       ├── xbogus.js                 # Thuat toan xbogus goc
│       └── index.js
├── App.js                            # Navigation Router & State Manager
├── app.json                          # Expo Application Configuration
├── index.js                          # Entry point & Headless Task registration
├── package.json                      # Dependencies & Scripts
├── .gitignore                        # Git ignore da chuan hoa
└── README.md                         # Tai lieu huong dan du an
```

---

## 4. Chi Tiet Ky Thuat Ve Giao Thuc TikTok IMSDK

### 4.1. Cac Header Bat Buoc Trong Request IMSDK
- `X-SS-STUB`: Gia tri MD5 Hash in hoa cua toan bo chuoi byte nhi phan Protobuf Body.
- `X-Bogus`: Chu ky bao ve request URL, duoc tao dua tren timestamp, user-agent va query params.
- `Cookie`: Chua chuoi phien hop le bao gom `sessionid`, `sid_tt`, `uid_tt`, `multi_sids`.
- `Content-Type`: `application/x-protobuf`

### 4.2. Thuat Toan Ma Hoa Protobuf Wire Format
File `src/utils/protobuf.js` thuc thi bo ma hoa va giai ma nhi phan doc lap, khong phu thuoc vao thu vien ngoai:
- Varint Encoding: Ho tro BigInt 64-bit cho cac field ID va Timestamp.
- Length-delimited Encoding: Xu ly chuoi UTF-8 va Sub-messages long nhau.
- Schema-less Decoding: Cho phep doc truc tiep cac field tag tu binary response do TikTok tra ve.

---

## 5. Huong Dan Cai Dat & Khoi Chay

### 5.1. Yeu Cau Moi Truong
- Node.js >= 18.0.0
- npm >= 9.0.0 hoac yarn
- Android SDK (API Level 34 hoac moi hon) & JDK 17 (neu bien dich ban Native Android)
- Thiet bi that Android hoac Trinh gia lap Android Emulator

### 5.2. Cai Dat Goi Phu Thuoc
```bash
cd tiktok_auto_app
npm install
```

### 5.3. Chay Trong Moi Truong Phat Trien (Development)
- Khoi dong trinh bien dich Expo:
  ```bash
  npx expo start
  ```
- Chay truc tiep tren thiet bi Android (Development Build):
  ```bash
  npm run android
  ```
- Chay tren Web Browser (kiem tra giao dien):
  ```bash
  npm run web
  ```

### 5.4. Bien Dich Ban Cai Dat Android (Release APK)
De tao ban APK doc lap de cai dat tren moi dien thoai Android:
```bash
cd android
./gradlew assembleRelease
```
File APK thanh pham se duoc luu tai:
`android/app/build/outputs/apk/release/app-release.apk`

---

## 6. Huong Dan Dua Len Git Repository

De day toan bo ma nguon len he thong quan ly ma nguon (GitHub, GitLab, Bitbucket):

1. Kiem tra trang thai ma nguon hien tai:
   ```bash
   git status
   ```

2. Them toan bo cac tep da chuan hoa:
   ```bash
   git add .
   ```

3. Thuc hien commit:
   ```bash
   git commit -m "feat: complete TikTokToe suite with Vibe Coding and Antigravity"
   ```

4. Lien ket toi Remote Repository (thay the duong dan bang repository cua ban):
   ```bash
   git remote add origin https://github.com/<YOUR_USER>/<YOUR_REPO>.git
   git branch -M main
   ```

5. Day ma nguon len may chu:
   ```bash
   git push -u origin main
   ```

---

## 7. Tuyen Bo Trach Nhiem & Ban Quyen (Disclaimer & License)

- Du an nay duoc phat trien vi muc dich nghien cuu hoc thuat, giao duc ve kien truc phan mem di dong, an ninh giao thuc mang va phuong phap lap trinh Vibe Coding voi Antigravity.
- Nguoi su dung tu chiu trach nhiem ve viec su dung phien lam viec va tuan thu dieu khoan dich vu cua nha cung cap nen tang.
- Giay phep su dung: MIT License.
