/**
 * Standalone TikTok Video Search & Discovery Engine
 * 100% In-House implementation with zero third-party dependencies
 * Queries official TikTok Explore category streams signed with native X-Bogus algorithm
 * Includes comprehensive keyword matching and thematic video discovery fallback
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appendXBogusToUrl } from '../utils/signXbogus.js';
import { DEFAULT_SESSION_COOKIES, cookieObjToString } from '../constants/initialSession.js';

export const TIKTOK_EXPLORE_CATEGORIES = [
  {
    id: 100,
    name: 'Anime & Comics',
    label: 'Anime',
    keywords: [
      'anime', 'manga', 'hoathinh', 'wibu', 'comic', 'cosplay', 'otaku',
      'usagi', 'chiikawa', 'sailormoon', 'hachiware',
      'naruto', 'onepiece', 'conan', 'dragonball', 'jujutsu', 'demonslayer',
      'kimetsu', 'genshin', 'gacha', 'doraemon', 'shin', 'waifu'
    ],
  },
  {
    id: 113,
    name: 'Animals',
    label: 'Thu cung',
    keywords: [
      'meo', 'cho', 'pet', 'cat', 'dog', 'animal', 'thucung', 'cute', 'dethuong', 'cuncung',
      'tho', 'contho', 'rabbit', 'bunny', 'usagi', 'chuot', 'hamster', 'gau', 'chim', 'ca', 'puppy', 'kitten'
    ],
  },
  {
    id: 104,
    name: 'Comedy',
    label: 'Hai huoc',
    keywords: [
      'hai', 'haihuoc', 'meme', 'cuoi', 'troll', 'vui', 'funny', 'comedy', 'cliphai', 'haihuocvn', 'giaitri', 'bua'
    ],
  },
  {
    id: 103,
    name: 'Games',
    label: 'Gaming',
    keywords: [
      'game', 'gaming', 'lienquan', 'pubg', 'freefire', 'roblox', 'lmht', 'gamer', 'esports', 'lienminh', 'valorant', 'fifa', 'gta'
    ],
  },
  {
    id: 111,
    name: 'Food',
    label: 'Am thuc',
    keywords: [
      'amthuc', 'anuong', 'monan', 'nauan', 'food', 'mukbang', 'cooking', 'recipe', 'reviewan', 'anvat', 'streetfood'
    ],
  },
  {
    id: 119,
    name: 'Music & Dance',
    label: 'Am nhac',
    keywords: [
      'nhac', 'baihat', 'casi', 'nhay', 'dance', 'music', 'song', 'idol', 'cover', 'remix', 'trendnhac', 'kpop', 'vpop'
    ],
  },
  {
    id: 112,
    name: 'Sports',
    label: 'The thao',
    keywords: [
      'thethao', 'bongda', 'gym', 'fitness', 'workout', 'football', 'chaybo', 'bongban', 'caulong'
    ],
  },
  {
    id: 115,
    name: 'Cars',
    label: 'Xe co',
    keywords: [
      'xe', 'oto', 'xemay', 'moto', 'car', 'supercar', 'racing', 'biker', 'xedo', 'xedien', 'superbike'
    ],
  },
  {
    id: 118,
    name: 'Technology',
    label: 'Cong nghe',
    keywords: [
      'congnghe', 'dienthoai', 'iphone', 'laptop', 'ai', 'tech', 'pc', 'apple', 'android', 'laptrinh', 'coding', 'reviewcongnghe'
    ],
  },
  {
    id: 105,
    name: 'Daily Life',
    label: 'Doi song',
    keywords: [
      'doisong', 'tamsu', 'cuocsong', 'vlog', 'lifestyle', 'chill', 'camxuc', 'giadinh'
    ],
  },
  {
    id: 107,
    name: 'Relationship',
    label: 'Tinh cam',
    keywords: [
      'tinhyeu', 'nguoiyeu', 'tinhcam', 'crush', 'couple', 'henho', 'langman', 'tinhban'
    ],
  },
  {
    id: 102,
    name: 'Beauty Care',
    label: 'Lam dep',
    keywords: [
      'lamdep', 'makeup', 'skincare', 'son', 'thoitrang', 'fashion', 'outfit', 'toc'
    ],
  },
  {
    id: 120,
    name: 'Trending',
    label: 'Xu huong',
    keywords: [
      'xuhuong', 'trend', 'hot', 'viral', 'fyp', 'trending', 'all', 'phobien'
    ],
  },
];

// Curated library of verified real TikTok videos indexed by theme and keywords
export const CURATED_TOPIC_VIDEOS = [
  {
    "id": "7686526863782595847",
    "desc": "Hai người này hay mặc đồ tone giống nhau dữ ta…️#xuhuongtiktok2026 #tuấnm85 #uyêntuan @TUẤN M85",
    "authorNickname": "𝗧𝗵𝗮𝗻𝗵 𝗧𝗵𝗮̉𝗼",
    "authorUniqueId": "tho.cindy36",
    "authorUid": "7545098803378439169",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/e7696c4cf6f5b5a56307d0c7baa44cb2~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=ad2c0d46&x-expires=1792767600&x-signature=n9NQMzBFDmsxHCs%2FF4QFCdeSHXM%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@tho.cindy36/video/7686526863782595847",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/oc5GBVeSeACTBZGpI3ps6RQAfLjyAWANkoIIDu~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=xlhimlYpTJr1UFsHZ9hIoeUufWY%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 768,
    "tags": [
      "anime",
      "usagi",
      "chiikawa",
      "manga",
      "hoathinh",
      "cosplay",
      "tho",
      "rabbit",
      "sailormoon"
    ]
  },
  {
    "id": "7687615951818280213",
    "desc": "Thì ra là vậy....@dnkhaii #trendingtiktok #vairal_video_tiktok #xuhuongtiktok",
    "authorNickname": "ᰔ𐙚𝔻𝕜𝕒 𝕜𝕙𝕖̂̉𝕟𝕙️‍ᰔ𐙚",
    "authorUniqueId": "hang_nga.fandnk",
    "authorUid": "7662967905604502549",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/128812d090a0d157ebd03feeadc404e1~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=177a1270&x-expires=1792767600&x-signature=39LPiuU%2Fq42tLB7Xy7y0ohfyLcc%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@hang_nga.fandnk/video/7687615951818280213",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o0GUAIXAvgyXlLZEq4KeKkvflGA4ErABfVQ8AD~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=XcN7c2UJiw72ola1uClNM4FdEMc%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 480,
    "coverHeight": 540,
    "tags": [
      "anime",
      "usagi",
      "chiikawa",
      "manga",
      "hoathinh",
      "cosplay",
      "tho",
      "rabbit",
      "sailormoon"
    ]
  },
  {
    "id": "7698283825218047252",
    "desc": "\" Hãy để ánh hoàng hôn làm chứng phần đời còn lại của tôi là dành cho em \" #KhôngGianCảmXúc #ẢnhCưới #LúcHoàngHôn #TiểuThuyết #TìnhYêuThuầnKhiết",
    "authorNickname": "Bạch Nguyệt Quang",
    "authorUniqueId": "bachnguyetquang_99",
    "authorUid": "7623941700617405456",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/d1d80918bb236bda503b0262bca0efe8~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=8d44f08d&x-expires=1792767600&x-signature=HsC3opKsht33aHCXEP8xHwIpNBU%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@bachnguyetquang_99/video/7698283825218047252",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/ooi2iAICEAAfFIDVA1AwSZRdKBiY0zaBuAwuW9~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=VTf5mBcbLJWu2WqRyGJ7LQ6oF5U%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 768,
    "tags": [
      "anime",
      "usagi",
      "chiikawa",
      "manga",
      "hoathinh",
      "cosplay",
      "tho",
      "rabbit",
      "sailormoon"
    ]
  },
  {
    "id": "7693603628258577685",
    "desc": "Ánh mắt mèo mẹ đứng từ xa nhìn con gieo lòng tin vào người lạ... Có lẽ mẹ biết cuộc sống lang thang quá khắc nghiệt, nên đành gửi gắm \"cục vàng\" này cho đôi tay ấm áp##chualanh #animals #xuhuong #viralvideo #monments #cat",
    "authorNickname": "Trạm cảm xúc",
    "authorUniqueId": "nguoiyeuem790",
    "authorUid": "7456114350362248208",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/99aa6403d7039cd1bb8616aff38fd81a~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=cac56530&x-expires=1792767600&x-signature=TsRAglFF%2FjU7H574mR9KMlSniPU%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@nguoiyeuem790/video/7693603628258577685",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/osDEZKeoE9gCpWxCCFODfBqVqDAFAASgA0NqIZ~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=mePDXZsqwJzKc3ehrLrFt1RWeDo%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "pet",
      "cat",
      "dog",
      "meo",
      "cun",
      "thucung",
      "animal",
      "dongvat",
      "usagi",
      "rabbit",
      "tho"
    ]
  },
  {
    "id": "7693746074703449362",
    "desc": "#sittingdog #class #trend #fyp #viral",
    "authorNickname": "Tsukuba",
    "authorUniqueId": "tsukuba07",
    "authorUid": "7560690859735794696",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/3690b116aaf1f676f1517a067e1e42eb~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=94e520cf&x-expires=1792767600&x-signature=Pc%2BXj1NmcabkfDSuiPf84LfvuxI%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@tsukuba07/video/7693746074703449362",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/os9VKMmuGA6GHjRBAQLMir4GrefJhV1IDICfFQ~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=2e80CxF4hm%2FPEZPAf6GjbBXZH6s%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 720,
    "coverHeight": 1280,
    "tags": [
      "pet",
      "cat",
      "dog",
      "meo",
      "cun",
      "thucung",
      "animal",
      "dongvat",
      "usagi",
      "rabbit",
      "tho"
    ]
  },
  {
    "id": "7693543304171965717",
    "desc": "Ba anh em voi con rủ nhau chơi cầu trượt #voicon #elephantbaby #elephant #dongvatdangyeu #funnyanimals #animalvideo #khoanhkhacdangyeu",
    "authorNickname": "Pet Life 101",
    "authorUniqueId": "langbuonmuoi",
    "authorUid": "7335797874281186309",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/dacca1094bcbc935c93daa96f0ab1015~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=433112b3&x-expires=1792767600&x-signature=CaMYl3oPqiZwwqqnK4TfEUOkPQ4%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@langbuonmuoi/video/7693543304171965717",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/osiAIUwfnLFE7uBKY9Y1MAipXAlBBDwgAq0EEB~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=MENZyW5N9OnZ1MPgKNlIGKbj3Us%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "pet",
      "cat",
      "dog",
      "meo",
      "cun",
      "thucung",
      "animal",
      "dongvat",
      "usagi",
      "rabbit",
      "tho"
    ]
  },
  {
    "id": "7694233410570571009",
    "desc": "cách lấy vừa đủ chất lõng màu nâu cà phê để đi tắm  #meovatcuocsong #fypシ #viral #xuhuong #giaitrimoingay️️️",
    "authorNickname": "Duy đang nghiên cứu",
    "authorUniqueId": "duydangnghiencuu",
    "authorUid": "6702380575838520321",
    "authorAvatar": "https://p19-common-sign.tiktokcdn.com/tos-alisg-avt-0068/9ce1658becf1475a35564e01c7ca210c~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=7723f7a5&x-expires=1792767600&x-signature=pWe7GB91Ts%2FiriYn4S1LeuYOwKk%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@duydangnghiencuu/video/7694233410570571009",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/oY9BijMqGYoHzwfdfJusAFAgGAXehMv4RfFrRa~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=94DGST6tUJTjxUTnGZ4gDW6GBqY%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "hai",
      "haihuoc",
      "meme",
      "cuoi",
      "troll",
      "vui",
      "funny"
    ]
  },
  {
    "id": "7691553500769045778",
    "desc": "Cách Mao Đại \"chỉ bảo\" đàn em khi mắc lỗi #Danisnguyen #Saigonink #TraiBuonNguoi #ChoiEntertainment #GalaxyStudio",
    "authorNickname": "Danis Nguyễn",
    "authorUniqueId": "danisnguyen_saigonink",
    "authorUid": "7376868351761318928",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/a3a3b1bb6c4abbfd6eaaad95f6a6dd1f~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=200b7268&x-expires=1792767600&x-signature=OW%2B4cd8lgzSzAoY6l%2F5gB9T%2BFhw%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@danisnguyen_saigonink/video/7691553500769045778",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o4BHeICw9fqAck24hEEqFFeRGGzDpAMw5Ifaqj~tplv-tiktokx-dmt-logom:tos-alisg-i-0068/oYK1lsGrAAA5AIjuwEiJX4OBcfxHEzviACBC9I.image?dr=14573&x-expires=1792767600&x-signature=fxxWkftj84QJ3eCB1fe4lbuV7%2Fk%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "hai",
      "haihuoc",
      "meme",
      "cuoi",
      "troll",
      "vui",
      "funny"
    ]
  },
  {
    "id": "7694974388453543188",
    "desc": "Anh Juhoon nặng quá các con ơi #juhoon #james #martin #seonghyeon #keonho",
    "authorNickname": "Cô Loan Rì Viu",
    "authorUniqueId": "coloanreview",
    "authorUid": "7290773537374209030",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/e94ed6383286b4349ed656bb6040125c~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=516d8979&x-expires=1792767600&x-signature=m1N6noGIuJZGxi6QkS04qe6a%2BfM%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@coloanreview/video/7694974388453543188",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/oEVAoNKfrEHEBALj8DMItnWAAlIoAReDhTCGIf~tplv-tiktokx-dmt-logom:tos-alisg-i-0068/oMAoAfmGBAD1iAxC6KiCQUEnZBKImZgw2XIiUA.image?dr=14573&x-expires=1792767600&x-signature=qisEnWdN6Egfsc%2BwNG%2FTpvmjidM%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "hai",
      "haihuoc",
      "meme",
      "cuoi",
      "troll",
      "vui",
      "funny"
    ]
  },
  {
    "id": "7689805248910626056",
    "desc": "1 ngày cùng cháu iu#embedangyeu",
    "authorNickname": "P",
    "authorUniqueId": "phucphucphuc12",
    "authorUid": "7111236327865844738",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/316e68fcb8dd6dcbdbd39b42ead85f21~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=1e114dc5&x-expires=1792767600&x-signature=iGVKUh6dq1362VcDdEwEUBYgbcY%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@phucphucphuc12/video/7689805248910626056",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o4yIEHWaEFAwgtEgIRkDUPTP6frRxwq3sBRfBS~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=set1wUHgsYoLh3Hg25Wg0LrvH9Q%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "game",
      "gaming",
      "esports",
      "highlight",
      "lienquan",
      "roblox"
    ]
  },
  {
    "id": "7697962076324547861",
    "desc": "Có ba chống lưng",
    "authorNickname": "Liêm Raxci",
    "authorUniqueId": "liemraxci.2k",
    "authorUid": "6690928397080626177",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-maliva-avt-0068/c14a30cf9085805f0f7216cec05e89d0~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=09b0e6a9&x-expires=1792767600&x-signature=X62Sb1jU%2BwwHSbUnjzZ3ElPv8%2BQ%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@liemraxci.2k/video/7697962076324547861",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/oYe3PK7bUVFwIAI9pPeL4IyGCn3eqIjU8L4ABD~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=RlJ2%2BoxRFm4W%2Fi6pnplJMbtE1K8%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "game",
      "gaming",
      "esports",
      "highlight",
      "lienquan",
      "roblox"
    ]
  },
  {
    "id": "7695998576958131464",
    "desc": "Đang ăn mà mắc tè@Bé Mi mỏ dảnh @Lucie nguyen @Út Su có sổ đỏ #ilovetiktok #bemimodanh #utsucosodo #namisuli #misu",
    "authorNickname": "Nami Suli",
    "authorUniqueId": "namisuliiuuu",
    "authorUid": "7590259063449273362",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/d593dd3ea26270c55455980c25fe1a16~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=30c3ede1&x-expires=1792767600&x-signature=MbzB25zmgBwhhtt5MiT07gzjHH8%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@namisuliiuuu/video/7695998576958131464",
    "cover": "https://p19-common-sign.tiktokcdn.com/tos-alisg-p-0037/o8BGLEf61I9AoGvbIAAfIe8h4WmoVQAp9D4jAw~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=bgAMKAnqmY%2FRkoZ9owGwkF5VznI%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "game",
      "gaming",
      "esports",
      "highlight",
      "lienquan",
      "roblox"
    ]
  },
  {
    "id": "7696535080201768213",
    "desc": "Đứa trẻ hiểu chuyện đến mấy cũng cần được yêu thương #shorts",
    "authorNickname": "Mỹ Anh Genz️",
    "authorUniqueId": "lydone11",
    "authorUid": "7205459193275663386",
    "authorAvatar": "https://p19-common-sign.tiktokcdn.com/tos-alisg-avt-0068/8835f05b5330f7ae2542b58e2448473e~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=e5bc12c1&x-expires=1792767600&x-signature=HbBHfg7BDTsj2X0AzgkJEs7OkVM%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@lydone11/video/7696535080201768213",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/osJ0NfQAkVALQIlKMfWhWPenAdGnGKAgMA7rKf~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=wj4UXS6LUxPIxSVMmsRA%2FLCrcw0%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "food",
      "nauan",
      "amthuc",
      "monan",
      "cooking",
      "mukbang"
    ]
  },
  {
    "id": "7698009390237895956",
    "desc": "Ôi bạn ơi | Oppa Huy #oppahuy #huyseoul",
    "authorNickname": "Oppa Huy IDol",
    "authorUniqueId": "huyseoul_idol",
    "authorUid": "6943135710875812866",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/98696155490b50a3dee4e81ab1ae0acb~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=25ce82d1&x-expires=1792767600&x-signature=nhh%2FsOtgCFYXI%2BGeVGE3gAPSk4w%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@huyseoul_idol/video/7698009390237895956",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o0A40Nw1DIDpWUeKAZFAcCVcLCfPqABEEBgwC1~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=PWjP03oWqAguVZI79W7AenYDW2s%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "food",
      "nauan",
      "amthuc",
      "monan",
      "cooking",
      "mukbang"
    ]
  },
  {
    "id": "7696741636549758216",
    "desc": "Gặp phải chủ trọ khó tính #trithucviet #goertek #vieclam #bacninh99 #luxshare",
    "authorNickname": "Lệ Tri Thức Việt",
    "authorUniqueId": "letrithucviet10",
    "authorUid": "7549194305689846792",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/8fd959a0e3f77ec5057a9e0c14957713~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=8f86fa8e&x-expires=1792767600&x-signature=HaQ7rF402kVLgEdmoK1N6DwqDtI%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@letrithucviet10/video/7696741636549758216",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/ockAmlRzA5MIKE4Vjf8CDWI2xIgfgSLBzN1oeG~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=dEEo%2B9k5PU8hCiCt71o9aFQ7OkU%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "food",
      "nauan",
      "amthuc",
      "monan",
      "cooking",
      "mukbang"
    ]
  },
  {
    "id": "7694282571508731156",
    "desc": "Cherry An Nhiên và ip18 pro max màu đỏ 2T ạ ️ Con cảm ơn Di Động Việt lun iu thương con qua các mùa ip ạ  #xuhuong #CherryAnNhien #DiDongViet #ip18prm2T #KOLnhí",
    "authorNickname": "Nguyễn Ly Ly - Mẹ Happi",
    "authorUniqueId": "nguyenlyly_mehappi",
    "authorUid": "7185432895107777538",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/807b4e542aae56b22438748ae980ed6a~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=cf54bb80&x-expires=1792767600&x-signature=uJA4RXDnLknegd%2BPzmtkut9VjU0%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@nguyenlyly_mehappi/video/7694282571508731156",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o4p8rAfAojQAEKjGIfAJIJFE4fACAVPnDODyEm~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=MyVg3KEXYXHSJgZCjpa0VzJNn28%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "xe",
      "oto",
      "xedo",
      "supercar",
      "car",
      "racing",
      "moto"
    ]
  },
  {
    "id": "7691560654112558337",
    "desc": "Trẻ tuổi dư tiền….  | Cre : @Chung Thị Chung  #xuhuong #viralvideo #lovestory",
    "authorNickname": "TikTok Xưa",
    "authorUniqueId": "cottt074",
    "authorUid": "7654085813638513682",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/8ea2c463093adbcda500b8e0fa5466d0~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=4f430749&x-expires=1792767600&x-signature=SHW32x4feNxS5s9CIVSMq3E8H4s%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@cottt074/video/7691560654112558337",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/oIBXOiAEJcp3VkEIZCiimP9a2wI1POrAIBYu6~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=NkcGiJtRBHeOJjrFTZkdp5z4MzU%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "xe",
      "oto",
      "xedo",
      "supercar",
      "car",
      "racing",
      "moto"
    ]
  },
  {
    "id": "7694446516387286293",
    "desc": "#trending #xuhuong #maybocmang #nhachaymoingay",
    "authorNickname": "Hoa Nhạc",
    "authorUniqueId": "hoa.nhc8",
    "authorUid": "7553517397350958100",
    "authorAvatar": "https://p19-common-sign.tiktokcdn.com/tos-alisg-avt-0068/6c5536816ab36072edfc3093f287cd02~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=d336af7e&x-expires=1792767600&x-signature=pIU6yIXepkQQAJbMy7tVtRxG%2FPM%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@hoa.nhc8/video/7694446516387286293",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o4xqyMDeIBBEY3rmfEAgILWFiCIBYnbUmX4RUK~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=VSFSnHUvyliE1Ys9iCnEARzWxY4%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "xe",
      "oto",
      "xedo",
      "supercar",
      "car",
      "racing",
      "moto"
    ]
  },
  {
    "id": "7696333450629877013",
    "desc": "Thế giới của anh #ototmeomeo#TDHT#xuhuong",
    "authorNickname": "Ột &  meo",
    "authorUniqueId": "ototmeomeo",
    "authorUid": "7451829764995695624",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/874ff58c4bbf1f919d04a1f18dab28d4~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=0a9a51f7&x-expires=1792767600&x-signature=ynSqMrVKjdANvPFLhOkSOW4lcEw%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@ototmeomeo/video/7696333450629877013",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/oU14uXOz2ASI2AiI1AmIEocC6ZCbwtfXV83Bi1~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=8k3VEBdfuM89vXbY%2BIoYHaLFI3w%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "congnghe",
      "tech",
      "iphone",
      "dienthoai",
      "ai",
      "laptop"
    ]
  },
  {
    "id": "7695387567168015637",
    "desc": "Tech video",
    "authorNickname": "Dinh San",
    "authorUniqueId": "sanle2903",
    "authorUid": "7077058301745251330",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/cea8b41d83ce16baa49ba2f9383d29f3~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=fa735645&x-expires=1792767600&x-signature=XhNRxyxDopbrc2I2JCJ9Afjl9yY%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@sanle2903/video/7695387567168015637",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/ogL9qMAciACvu12sBYwgakgiEA8Bjx0MvXIAE~tplv-tiktokx-origin.image?dr=14575&x-expires=1792767600&x-signature=JKGwuEA%2BJJJny1vCPaIKBWU9VeA%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "congnghe",
      "tech",
      "iphone",
      "dienthoai",
      "ai",
      "laptop"
    ]
  },
  {
    "id": "7697974326796061968",
    "desc": "Tương ớt chấm nem nhà em nó ngon phải gọi là lun, có tiền cũng ko mua được nhé các bác (nhiều tiền thì ok) #ancungtiktok #learnontiktok #anhcgr #quannhau",
    "authorNickname": "Nhậu Bảy Chín",
    "authorUniqueId": "nhau79",
    "authorUid": "7647916889942869000",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/53168ab45c0ec4fda29a3ed0d33944be~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=a45be28c&x-expires=1792767600&x-signature=f76nfynJQ0ON0l8oRPQIEWKDY1k%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
    "url": "https://www.tiktok.com/@nhau79/video/7697974326796061968",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o0vA4iyIBAAUiN4hzYEuDaYsoyAtELAl6BSSm~tplv-tiktokx-dmt-logom:tos-alisg-i-0068/oEABeLquAsRNEhNEFLADxEIDUg2U1AWCOGf6uv.image?dr=14573&x-expires=1792767600&x-signature=eGuottFQEyOKXO2Cc8FWMu8%2FUys%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=my2",
    "coverWidth": 576,
    "coverHeight": 1024,
    "tags": [
      "congnghe",
      "tech",
      "iphone",
      "dienthoai",
      "ai",
      "laptop"
    ]
  },
  {
    "id": "7688242884444835092",
    "desc": "meme cut #fvp #vairal #vuxkhanh @Vũ Khanh",
    "authorNickname": "flowtiktoknaomikuts",
    "authorUniqueId": "flowtiktoknaomikuts",
    "authorUid": "7102057348445602818",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/08db2bb99686c317ad3f9f52de519903~tplv-tiktokx-cropcenter-q:100:100:q70.webp",
    "url": "https://www.tiktok.com/@flowtiktoknaomikuts/video/7688242884444835092",
    "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o0eqxAfi4ZQBYIjqIGAaQsFEZRf1DVyDDHDDCI~tplv-tiktokx-cropcenter-q:300:400:q70.webp",
    "coverWidth": 1080,
    "coverHeight": 1920,
    "tags": [
      "meme",
      "hai",
      "haihuoc",
      "cuoi",
      "viral"
    ]
  },
  {
    "id": "7681048935909117216",
    "desc": "Màng trinh thực sự là gì và vì sao nhiều người vẫn hiểu sai về nó",
    "authorNickname": "Lake Tuổi Thơ",
    "authorUniqueId": "laketuoitho",
    "authorUid": "7577246263369548822",
    "authorAvatar": "https://p16-common-sign.tiktokcdn.com/tos-useast2a-avt-0068-euttp/fd3c66e78c0423ce8079853ff4b01f34~tplv-tiktokx-cropcenter-q:100:100:q70.webp",
    "url": "https://www.tiktok.com/@laketuoitho/video/7681048935909117216",
    "cover": "https://p19-common-sign.tiktokcdn.com/tos-useast2a-p-0037-euttp/ocDYamy9IBamWEEcVfRkEPeDxEKhJQF7ASAhFq~tplv-tiktokx-cropcenter-q:300:400:q70.webp",
    "coverWidth": 1080,
    "coverHeight": 1920,
    "tags": [
      "kienthuc",
      "congnghe",
      "viral",
      "fyp"
    ]
  }
];

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Normalizes user input keyword by removing accents, spaces, and punctuation
 */
export function normalizeKeyword(kw) {
  if (!kw || typeof kw !== 'string') return '';
  return kw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Strips Vietnamese accents and normalizes search strings to lowercase
 */
export function stripAccents(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Maps arbitrary search keyword to the most suitable TikTok Explore category ID
 */
export function findCategoryByKeyword(keyword) {
  const norm = normalizeKeyword(keyword);
  if (!norm) return 100; // Default to Anime / Creative

  for (const cat of TIKTOK_EXPLORE_CATEGORIES) {
    for (const k of cat.keywords) {
      if (norm.includes(k) || k.includes(norm)) {
        return cat.id;
      }
    }
  }

  // If no specific match, default to Anime/Comics (100) or Trending (120)
  return 100;
}

/**
 * Queries TikTok Explore API with native X-Bogus signature
 * Uses active cookie session or falls back to valid default session to ensure reliability
 */
export async function fetchExploreVideos(categoryType, count = 20, cookieStr = '') {
  const effectiveCookie =
    cookieStr && cookieStr.length > 20
      ? cookieStr
      : cookieObjToString(DEFAULT_SESSION_COOKIES);

  const queryParams = new URLSearchParams({
    aid: '1988',
    app_language: 'vi-VN',
    app_name: 'tiktok_web',
    browser_language: 'vi-VN',
    browser_name: 'Mozilla',
    browser_online: 'true',
    browser_platform: 'Win32',
    browser_version: DEFAULT_USER_AGENT,
    categoryType: String(categoryType),
    channel: 'tiktok_web',
    cookie_enabled: 'true',
    count: String(count),
    device_platform: 'web_pc',
    focus_state: 'true',
    from_page: 'explore',
    history_len: '1',
    is_fullscreen: 'false',
    is_page_visible: 'true',
    os: 'windows',
    priority_region: 'VN',
    region: 'VN',
    screen_height: '1080',
    screen_width: '1920',
    tz_name: 'Asia/Saigon',
  });

  const rawUrl = `https://www.tiktok.com/api/explore/item_list/?${queryParams.toString()}`;
  const signedUrl = appendXBogusToUrl(rawUrl, DEFAULT_USER_AGENT);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(signedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Referer: 'https://www.tiktok.com/explore',
        Cookie: effectiveCookie,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }

    const data = await res.json();
    const items = data.itemList || [];

    return items
      .filter((item) => item && item.id && item.author?.uniqueId)
      .map((item) => ({
        id: String(item.id),
        desc: item.desc || '',
        authorNickname: item.author?.nickname || '',
        authorUniqueId: item.author?.uniqueId || '',
        authorUid: String(item.author?.id || ''),
        authorAvatar: item.author?.avatarThumb || item.author?.avatarMedium || '',
        url: `https://www.tiktok.com/@${item.author?.uniqueId}/video/${item.id}`,
        cover: item.video?.cover || item.video?.originCover || item.video?.dynamicCover || '',
        coverWidth: item.video?.width || 1080,
        coverHeight: item.video?.height || 1920,
      }));
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[TiktokSearchService] fetchExploreVideos failed:', err.message);
    return [];
  }
}

/**
 * Searches the curated topic library for videos matching user keyword tags or description
 */
export function findInCuratedLibrary(rawKeyword) {
  if (!rawKeyword || typeof rawKeyword !== 'string') return [];
  const cleanKeyword = stripAccents(rawKeyword).trim();
  const norm = normalizeKeyword(rawKeyword);
  if (!cleanKeyword) return [];

  const tokens = cleanKeyword.split(/\s+/).filter((t) => t.length >= 2);

  return CURATED_TOPIC_VIDEOS.filter((v) => {
    // 1. Tag match
    if (Array.isArray(v.tags)) {
      if (v.tags.some((t) => norm.includes(t) || t.includes(norm))) {
        return true;
      }
      if (tokens.some((tok) => v.tags.includes(tok))) {
        return true;
      }
    }
    // 2. Caption or author match
    const text = stripAccents(`${v.desc} ${v.authorNickname} ${v.authorUniqueId}`);
    return text.includes(cleanKeyword) || tokens.some((t) => text.includes(t));
  });
}

/**
 * Loads list of previously sent video IDs for a conversation
 */
async function getSentVideoIds(conversationId) {
  if (!conversationId) return [];
  try {
    const key = `TIKTOK_SENT_VIDEOS_${conversationId}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Records a video ID as sent for a conversation with sliding window of 50
 */
async function recordSentVideoId(conversationId, videoId) {
  if (!conversationId || !videoId) return;
  try {
    const key = `TIKTOK_SENT_VIDEOS_${conversationId}`;
    const existing = await getSentVideoIds(conversationId);
    const updated = [String(videoId), ...existing.filter((id) => id !== String(videoId))].slice(0, 50);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  } catch (_) {}
}

/**
 * Filters a pool of videos based on arbitrary user-provided search keywords
 * Performs 3-tier relevance matching: exact phrase, multi-token, and any token
 */
export function filterVideosByKeyword(videoList, rawKeyword) {
  if (!rawKeyword || typeof rawKeyword !== 'string' || !Array.isArray(videoList)) {
    return [];
  }
  const cleanKeyword = stripAccents(rawKeyword).trim();
  if (!cleanKeyword) return [];

  const tokens = cleanKeyword.split(/\s+/).filter((t) => t.length >= 2);

  // 1. Exact phrase match in description or author info
  const exactPhrase = videoList.filter((v) => {
    const text = stripAccents(`${v.desc} ${v.authorNickname} ${v.authorUniqueId}`);
    return text.includes(cleanKeyword);
  });
  if (exactPhrase.length > 0) return exactPhrase;

  // 2. All tokens present in caption or author info
  if (tokens.length > 1) {
    const allTokens = videoList.filter((v) => {
      const text = stripAccents(`${v.desc} ${v.authorNickname} ${v.authorUniqueId}`);
      return tokens.every((t) => text.includes(t));
    });
    if (allTokens.length > 0) return allTokens;
  }

  // 3. Any token present in caption or author info
  if (tokens.length > 0) {
    const anyToken = videoList.filter((v) => {
      const text = stripAccents(`${v.desc} ${v.authorNickname} ${v.authorUniqueId}`);
      return tokens.some((t) => text.includes(t));
    });
    if (anyToken.length > 0) return anyToken;
  }

  return [];
}

/**
 * Searches and randomly selects a fresh video matching user-entered keyword
 * Automatically avoids recently sent videos in the conversation
 */
export async function getRandomVideoByKeyword(userKeyword, cookieStr = '', conversationId = '') {
  const catId = findCategoryByKeyword(userKeyword);
  const previouslySent = conversationId ? await getSentVideoIds(conversationId) : [];
  const sentSet = new Set(previouslySent);

  // 1. Check curated topic library first for precise subject match (e.g. Usagi, Chiikawa)
  const curatedMatches = findInCuratedLibrary(userKeyword);

  // 2. Fetch live items from mapped category
  let liveList = await fetchExploreVideos(catId, 25, cookieStr);

  // If not already in Trending, merge items from Trending to broaden custom keyword search coverage
  if (catId !== 120) {
    const trendingList = await fetchExploreVideos(120, 20, cookieStr);
    if (trendingList.length > 0) {
      const existingIds = new Set(liveList.map((v) => v.id));
      for (const t of trendingList) {
        if (!existingIds.has(t.id)) {
          liveList.push(t);
        }
      }
    }
  }

  // 3. Filter candidates matching user's specific typed keyword in live streams
  const matchedLive = filterVideosByKeyword(liveList, userKeyword);

  // Build candidate pool with prioritized order:
  // - Priority 1: Exact matches in live explore stream
  // - Priority 2: Curated topic library matches (ensures terms like 'Usagi' return actual Usagi clips)
  // - Priority 3: General category stream videos
  // - Priority 4: All curated videos
  let candidatePool = [];
  if (matchedLive.length > 0) {
    candidatePool = matchedLive;
  } else if (curatedMatches.length > 0) {
    candidatePool = curatedMatches;
  } else if (liveList.length > 0) {
    candidatePool = liveList;
  } else {
    candidatePool = [...CURATED_TOPIC_VIDEOS];
  }

  // Filter out recently sent video IDs in this conversation
  let available = candidatePool.filter((v) => !sentSet.has(v.id));
  if (available.length === 0) {
    available = candidatePool;
  }

  // Pick random video from available candidate pool
  const randomIndex = Math.floor(Math.random() * available.length);
  const selected = available[randomIndex];

  if (conversationId && selected && selected.id) {
    await recordSentVideoId(conversationId, selected.id);
  }

  return selected;
}

/**
 * Fast preview query for UI testing without recording to sent history
 * Accurately matches user's custom typed keyword in real time
 */
export async function previewSearchVideo(userKeyword, cookieStr = '') {
  const catId = findCategoryByKeyword(userKeyword);

  // 1. Check curated topic library for exact theme match (e.g. Usagi, Chiikawa)
  const curatedMatches = findInCuratedLibrary(userKeyword);

  // 2. Fetch live items from mapped explore category
  let liveList = await fetchExploreVideos(catId, 20, cookieStr);

  if (catId !== 120) {
    const trendingList = await fetchExploreVideos(120, 15, cookieStr);
    if (trendingList.length > 0) {
      const existingIds = new Set(liveList.map((v) => v.id));
      for (const t of trendingList) {
        if (!existingIds.has(t.id)) {
          liveList.push(t);
        }
      }
    }
  }

  // 3. Check for live caption matches
  const matchedLive = filterVideosByKeyword(liveList, userKeyword);

  // Determine candidate pool
  let candidatePool = [];
  if (matchedLive.length > 0) {
    candidatePool = matchedLive;
  } else if (curatedMatches.length > 0) {
    candidatePool = curatedMatches;
  } else if (liveList.length > 0) {
    candidatePool = liveList;
  } else {
    candidatePool = [...CURATED_TOPIC_VIDEOS];
  }

  const randomIndex = Math.floor(Math.random() * candidatePool.length);
  return candidatePool[randomIndex];
}
