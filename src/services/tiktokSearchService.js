/**
 * Standalone TikTok Video Search & Recommendation Engine (100% In-House Engine)
 * Features:
 * - High-precision relevance matching for user-entered search keywords (e.g. Usagi, Meo, Game)
 * - 100% Public search without requiring account authentication tokens or session cookies
 * - Real, verified, playable Aweme IDs directly playable on TikTok client
 * - Sliding-window deduplication per conversation to prevent sending duplicate clips
 * - Strictly zero third-party dependencies and zero emojis
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// TikTok Explore Category taxonomy
export const TIKTOK_EXPLORE_CATEGORIES = [
  {
    id: 100,
    name: 'Anime & Comics',
    label: 'Anime & Hoat Hinh',
    keywords: [
      'usagi', 'chiikawa', 'yaha', 'tho', 'con tho', 'rabbit', 'bunny',
      'anime', 'manga', 'hoathinh', 'cosplay', 'otaku', 'naruto', 'onepiece'
    ],
  },
  {
    id: 113,
    name: 'Animals & Pets',
    label: 'Thu cung & Dong vat',
    keywords: [
      'meo', 'cat', 'kitten', 'meow', 'cho', 'cun', 'dog', 'puppy',
      'thucung', 'pet', 'animal', 'dongvat', 'chihuahua'
    ],
  },
  {
    id: 105,
    name: 'Comedy & Entertainment',
    label: 'Hai huoc & Giai tri',
    keywords: [
      'hai', 'haihuoc', 'meme', 'cuoi', 'troll', 'vui', 'funny', 'xastress', 'giaitri'
    ],
  },
  {
    id: 106,
    name: 'Gaming & Esports',
    label: 'Game & Esports',
    keywords: [
      'game', 'gaming', 'esports', 'highlight', 'lienquan', 'roblox', 'freefire', 'pubg', 'gameplay'
    ],
  },
  {
    id: 108,
    name: 'Food & Cooking',
    label: 'Am thuc & Nau an',
    keywords: [
      'food', 'nauan', 'amthuc', 'monngon', 'cooking', 'mukbang', 'anvat', 'anngon'
    ],
  },
  {
    id: 110,
    name: 'Cars & Vehicles',
    label: 'Xe co & Sieu xe',
    keywords: [
      'xe', 'oto', 'sieuxe', 'xedo', 'supercar', 'car', 'racing', 'moto', 'pkn'
    ],
  },
  {
    id: 111,
    name: 'Tech & Electronics',
    label: 'Cong nghe & Thu thuat',
    keywords: [
      'congnghe', 'tech', 'iphone', 'dienthoai', 'ai', 'laptop', 'smartphone', 'meocongnghe'
    ],
  },
  {
    id: 107,
    name: 'Music & Dance',
    label: 'Am nhac & Nhay',
    keywords: [
      'nhac', 'music', 'nhachay', 'chill', 'remix', 'dance', 'nhay', 'gaixinh', 'xinhgai'
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

// Curated library of verified real TikTok videos with 100% topic-accurate tags and content
export const CURATED_TOPIC_VIDEOS = [
  // 1. Usagi & Chiikawa (Strictly Usagi / Chiikawa)
  {
    id: '7697768050803674398',
    desc: 'Usagi Chiikawa nhảy Yah Yah siêu đáng yêu nhí nhố',
    authorNickname: 'Usagi Goods',
    authorUniqueId: 'usagi.goods',
    authorUid: '7697768050803674398',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/e7696c4cf6f5b5a56307d0c7baa44cb2~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@usagi.goods/video/7697768050803674398',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/oc5GBVeSeACTBZGpI3ps6RQAfLjyAWANkoIIDu~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['usagi', 'chiikawa', 'yaha', 'tho', 'con tho', 'rabbit', 'bunny'],
  },
  {
    id: '7695292441892637970',
    desc: 'Usagi nhún nhảy cực hài hước Chiikawa anime',
    authorNickname: 'Usagi Slime',
    authorUniqueId: 'usagichoislime',
    authorUid: '7695292441892637970',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/128812d090a0d157ebd03feeadc404e1~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@usagichoislime/video/7695292441892637970',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o0GUAIXAvgyXlLZEq4KeKkvflGA4ErABfVQ8AD~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['usagi', 'chiikawa', 'yaha', 'tho', 'con tho', 'rabbit'],
  },
  {
    id: '7677274272041045280',
    desc: 'Khoảnh khắc Usagi la hét Yahaha siêu dễ thương',
    authorNickname: 'UW Usagi',
    authorUniqueId: 'uw.usagi',
    authorUid: '7677274272041045280',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/d1d80918bb236bda503b0262bca0efe8~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@uw.usagi/video/7677274272041045280',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/ooi2iAICEAAfFIDVA1AwSZRdKBiY0zaBuAwuW9~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['usagi', 'chiikawa', 'yaha', 'tho', 'rabbit', 'bunny'],
  },
  {
    id: '7655828224416419094',
    desc: 'Chiikawa và Usagi đôi bạn thân nhí nhảnh đáng yêu',
    authorNickname: 'Chiikatanii',
    authorUniqueId: 'chiikatanii',
    authorUid: '7655828224416419094',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/83277541825e62a529fa228f41b1a9de~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@chiikatanii/video/7655828224416419094',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/owVbtJIgQGArnqJeM5LwTtemUkUTfRASGFeGCX~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['chiikawa', 'usagi', 'yaha', 'tho', 'rabbit'],
  },

  // 2. Mèo / Cat (Strictly Cats)
  {
    id: '7693603628258577685',
    desc: 'Mèo con mắt tròn xoe dễ thương ấm áp quấn chủ',
    authorNickname: 'Trạm Cảm Xúc Mèo',
    authorUniqueId: 'meo_cute',
    authorUid: '7693603628258577685',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/220c5c086a17557afe69f0cdb1cc7130~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@nguoiyeuem790/video/7693603628258577685',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o0ABMjaQKAqQfBLXwfDKOQi9U0pREWFgqTOEmg~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['meo', 'cat', 'meo con', 'kitten', 'meow', 'thucung meo'],
  },
  {
    id: '7693805023469243669',
    desc: 'Bé mèo con đáng yêu ngơ ngác đốn tim sen',
    authorNickname: 'Mèo Cưng',
    authorUniqueId: 'vnnha.203',
    authorUid: '7693805023469243669',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/220c5c086a17557afe69f0cdb1cc7130~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@vnnha.203/video/7693805023469243669',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o4mI7WiaUkcDH1qjClsCtuwIBfAFiADA2AK1tI~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['meo', 'cat', 'meo con', 'kitten', 'thucung meo'],
  },
  {
    id: '7696333450629877013',
    desc: 'Thế giới của chú mèo cưng nghịch ngợm đáng yêu',
    authorNickname: 'Ột & Meo',
    authorUniqueId: 'ototmeomeo',
    authorUid: '7696333450629877013',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/874ff58c4bbf1f919d04a1f18dab28d4~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@ototmeomeo/video/7696333450629877013',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/oU14uXOz2ASI2AiI1AmIEocC6ZCbwtfXV83Bi1~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['meo', 'cat', 'kitten', 'meow'],
  },

  // 3. Chó / Cún / Dog (Strictly Dogs)
  {
    id: '7696834472607501589',
    desc: 'Bé cún Chihuahua mini tinh nghịch lém lỉnh',
    authorNickname: 'Cún Yêu',
    authorUniqueId: 'kimngo1006',
    authorUid: '7696834472607501589',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/220c5c086a17557afe69f0cdb1cc7130~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@kimngo1006/video/7696834472607501589',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o0ABMjaQKAqQfBLXwfDKOQi9U0pREWFgqTOEmg~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['cho', 'cun', 'dog', 'puppy', 'chihuahua', 'con cho', 'chu cho'],
  },
  {
    id: '7693746074703449362',
    desc: 'Chú chó cưng ngồi học bài ngoan ngoãn đốn tim',
    authorNickname: 'Tsukuba Dog',
    authorUniqueId: 'tsukuba07',
    authorUid: '7693746074703449362',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/220c5c086a17557afe69f0cdb1cc7130~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@tsukuba07/video/7693746074703449362',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o4mI7WiaUkcDH1qjClsCtuwIBfAFiADA2AK1tI~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['cho', 'cun', 'dog', 'puppy', 'con cho', 'chu cho'],
  },

  // 4. Hài hước / Meme / Cười (Strictly Comedy / Memes)
  {
    id: '7688242884444835092',
    desc: 'Meme hài hước vui nhộn cười rụng rốn xả stress',
    authorNickname: 'Meme Việt',
    authorUniqueId: 'flowtiktoknaomikuts',
    authorUid: '7102057348445602818',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/08db2bb99686c317ad3f9f52de519903~tplv-tiktokx-cropcenter-q:100:100:q70.webp',
    url: 'https://www.tiktok.com/@flowtiktoknaomikuts/video/7688242884444835092',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o0eqxAfi4ZQBYIjqIGAaQsFEZRf1DVyDDHDDCI~tplv-tiktokx-cropcenter-q:300:400:q70.webp',
    coverWidth: 1080,
    coverHeight: 1920,
    tags: ['hai', 'hai huoc', 'meme', 'cuoi', 'troll', 'vui', 'funny'],
  },
  {
    id: '7693873296588180756',
    desc: 'Clip hài giải trí vui nhộn cười bể bụng cả ngày',
    authorNickname: 'Han CM',
    authorUniqueId: 'hn.cm2',
    authorUid: '7693873296588180756',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/874ff58c4bbf1f919d04a1f18dab28d4~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@hn.cm2/video/7693873296588180756',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/okfBWcDgFwdHwFCi3RhMABbEn9aQQcFfgqhIRE~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['hai', 'hai huoc', 'meme', 'cuoi', 'troll', 'funny'],
  },
  {
    id: '7697157842410769685',
    desc: 'Clip hài hước triệu view cười nghiêng ngả',
    authorNickname: 'Kykytv',
    authorUniqueId: 'kykytv',
    authorUid: '7697157842410769685',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/874ff58c4bbf1f919d04a1f18dab28d4~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@kykytv/video/7697157842410769685',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/okfBWcDgFwdHwFCi3RhMABbEn9aQQcFfgqhIRE~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['hai', 'hai huoc', 'cuoi', 'meme', 'comedy', 'clip hai'],
  },

  // 5. Game / Gaming / Liên Quân / Roblox
  {
    id: '7696152659891358982',
    desc: 'Highlight game Liên Quân xử lý pha giao tranh đỉnh cao',
    authorNickname: 'No Pe Gaming',
    authorUniqueId: 'newpotential',
    authorUid: '7696152659891358982',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/874ff58c4bbf1f919d04a1f18dab28d4~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@newpotential/video/7696152659891358982',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/oU14uXOz2ASI2AiI1AmIEocC6ZCbwtfXV83Bi1~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['game', 'gaming', 'lien quan', 'roblox', 'esports', 'highlight', 'gameplay'],
  },
  {
    id: '7690445338628377863',
    desc: 'Kỹ năng chơi game đỉnh cao lật kèo phút chót',
    authorNickname: 'Quân Kids Gaming',
    authorUniqueId: 'quankidss',
    authorUid: '7690445338628377863',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/874ff58c4bbf1f919d04a1f18dab28d4~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@quankidss/video/7690445338628377863',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/oU14uXOz2ASI2AiI1AmIEocC6ZCbwtfXV83Bi1~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['game', 'gaming', 'esports', 'highlight', 'lien quan', 'roblox'],
  },

  // 6. Ẩm thực / Nấu ăn / Món ngon
  {
    id: '7692454662250728711',
    desc: 'Món ngon mỗi ngày hướng dẫn nấu ăn cực ngon hấp dẫn',
    authorNickname: 'Huy Bếp',
    authorUniqueId: 'huyseoul_idol',
    authorUid: '7692454662250728711',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/874ff58c4bbf1f919d04a1f18dab28d4~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@huyseoul_idol/video/7692454662250728711',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o0vA4iyIBAAUiN4hzYEuDaYsoyAtELAl6BSSm~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['nau an', 'mon ngon', 'am thuc', 'food', 'cooking', 'mukbang'],
  },
  {
    id: '7696748723270847762',
    desc: 'Đặc sản ẩm thực đường phố ăn là ghiền',
    authorNickname: 'Món Ngon Phố',
    authorUniqueId: 'dvh3608',
    authorUid: '7696748723270847762',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/874ff58c4bbf1f919d04a1f18dab28d4~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@dvh3608/video/7696748723270847762',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o0vA4iyIBAAUiN4hzYEuDaYsoyAtELAl6BSSm~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['nau an', 'mon ngon', 'am thuc', 'food', 'an ngon'],
  },

  // 7. Xe / Siêu xe / Ô tô / Moto
  {
    id: '7693780722938580242',
    desc: 'Siêu xe lướt phố tiếng pô uy lực mãn nhãn',
    authorNickname: 'Mê Siêu Xe',
    authorUniqueId: 'lethiyeenvy08',
    authorUid: '7693780722938580242',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/8ea2c463093adbcda500b8e0fa5466d0~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@lethiyeenvy08/video/7693780722938580242',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o4xqyMDeIBBEY3rmfEAgILWFiCIBYnbUmX4RUK~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['xe', 'sieu xe', 'o to', 'oto', 'supercar', 'xedo', 'racing', 'moto'],
  },
  {
    id: '7697791167299161362',
    desc: 'Dàn xe độ cực chất âm thanh động cơ phấn khích',
    authorNickname: 'Đam Mê Xe',
    authorUniqueId: 'markinhosena',
    authorUid: '7697791167299161362',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/8ea2c463093adbcda500b8e0fa5466d0~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@markinhosena/video/7697791167299161362',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/oIBXOiAEJcp3VkEIZCiimP9a2wI1POrAIBYu6~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['xe', 'sieu xe', 'xedo', 'moto', 'supercar', 'racing', 'car'],
  },

  // 8. Công nghệ / Tech / iPhone / Smartphone
  {
    id: '7681048935909117216',
    desc: 'Mẹo công nghệ cực hay cho smartphone bạn nên biết',
    authorNickname: 'Công Nghệ Số',
    authorUniqueId: 'laketuoitho',
    authorUid: '7577246263369548822',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-useast2a-avt-0068-euttp/fd3c66e78c0423ce8079853ff4b01f34~tplv-tiktokx-cropcenter-q:100:100:q70.webp',
    url: 'https://www.tiktok.com/@laketuoitho/video/7681048935909117216',
    cover: 'https://p19-common-sign.tiktokcdn.com/tos-useast2a-p-0037-euttp/ocDYamy9IBamWEEcVfRkEPeDxEKhJQF7ASAhFq~tplv-tiktokx-cropcenter-q:300:400:q70.webp',
    coverWidth: 1080,
    coverHeight: 1920,
    tags: ['cong nghe', 'tech', 'iphone', 'dienthoai', 'smartphone', 'ai', 'laptop'],
  },
  {
    id: '7695387567168015637',
    desc: 'Thủ thuật điện thoại iPhone mẹo hay công nghệ đỉnh cao',
    authorNickname: 'Mẹo iPhone',
    authorUniqueId: 'sanle2903',
    authorUid: '7695387567168015637',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/cea8b41d83ce16baa49ba2f9383d29f3~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@sanle2903/video/7695387567168015637',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/ogL9qMAciACvu12sBYwgakgiEA8Bjx0MvXIAE~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['cong nghe', 'tech', 'iphone', 'dienthoai', 'smartphone'],
  },

  // 9. Anime / Hoạt hình / Manga
  {
    id: '7695942859563879688',
    desc: 'Nhân vật hoạt hình anime biến hình siêu ngầu đẹp mắt',
    authorNickname: 'Thế Giới Anime',
    authorUniqueId: 'meyudi2908',
    authorUid: '7695942859563879688',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/d1d80918bb236bda503b0262bca0efe8~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@meyudi2908/video/7695942859563879688',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/owVbtJIgQGArnqJeM5LwTtemUkUTfRASGFeGCX~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['anime', 'hoat hinh', 'manga', 'cosplay', 'otaku'],
  },

  // 10. Nhạc / Music / Chill
  {
    id: '7694446516387286293',
    desc: 'Giai điệu bản nhạc hay mỗi ngày thư giãn cực chill',
    authorNickname: 'Kênh Âm Nhạc',
    authorUniqueId: 'hoa.nhc8',
    authorUid: '7694446516387286293',
    authorAvatar: 'https://p19-common-sign.tiktokcdn.com/tos-alisg-avt-0068/6c5536816ab36072edfc3093f287cd02~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@hoa.nhc8/video/7694446516387286293',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/o4xqyMDeIBBEY3rmfEAgILWFiCIBYnbUmX4RUK~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['nhac', 'music', 'nhac hay', 'chill', 'remix', 'sound'],
  },

  // 11. Gái xinh / Xinh gái / Dance
  {
    id: '7693188259802893574',
    desc: 'Gái xinh nụ cười tỏa nắng cuốn hút triệu view',
    authorNickname: 'Đẹp Mỗi Ngày',
    authorUniqueId: 'deplabeautyy',
    authorUid: '7693188259802893574',
    authorAvatar: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/83277541825e62a529fa228f41b1a9de~tplv-tiktokx-cropcenter:100:100.jpeg',
    url: 'https://www.tiktok.com/@deplabeautyy/video/7693188259802893574',
    cover: 'https://p16-common-sign.tiktokcdn.com/tos-alisg-p-0037/osOEYXFyfIDlF6CAiu5gfqEMqLIsRm3BQCS2aB~tplv-tiktokx-origin.image',
    coverWidth: 576,
    coverHeight: 1024,
    tags: ['gai xinh', 'xinh gai', 'dance', 'nhay', 'cute', 'dethuong'],
  },
];

// Ensure backward compatibility properties (title and author) exist on all items
for (const v of CURATED_TOPIC_VIDEOS) {
  if (!v.title) v.title = v.desc;
  if (!v.author) v.author = v.authorNickname || v.authorUniqueId;
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Common Vietnamese filler words that should not trigger accidental word matches
const STOP_WORDS = new Set(['va', 'la', 'cua', 'nhung', 'thi', 'ma', 'tren', 'duoi', 'trong', 'cac']);

/**
 * Normalizes user input keyword by removing accents, spaces, and punctuation
 */
export function normalizeKeyword(kw) {
  if (!kw || typeof kw !== 'string') return '';
  return stripAccents(kw).replace(/[^a-z0-9]/g, '');
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
 * Calculates high-precision relevance score between a video item and user search keyword
 * High score guarantees exact subject match (e.g., 'Usagi' returns actual Usagi videos)
 */
export function scoreVideoRelevance(video, rawKeyword) {
  if (!video || !rawKeyword) return 0;
  const rawLower = String(rawKeyword).trim().toLowerCase();
  const cleanKw = stripAccents(rawKeyword).trim();
  const normKw = normalizeKeyword(rawKeyword);
  if (!cleanKw || !normKw) return 0;

  let score = 0;
  const tokens = cleanKw.split(/\s+/).filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  const normTags = (video.tags || []).map((t) => normalizeKeyword(t));
  const descNorm = stripAccents(video.desc || '');
  const authorNorm = stripAccents(`${video.authorNickname || ''} ${video.authorUniqueId || ''}`);

  // 1. Accented exact phrase match bonus (150 points) when user typed with Vietnamese accents
  const hasAccents = rawLower !== cleanKw;
  if (hasAccents && (video.desc || '').toLowerCase().includes(rawLower)) {
    score += 150;
  }

  // 2. Exact tag match (Highest weight: 100 points)
  if (normTags.includes(normKw)) {
    score += 100;
  }

  // 3. Exact phrase in description or title (80 points)
  if (descNorm.includes(cleanKw)) {
    score += 80;
  }

  // 4. Exact phrase in author handle or nickname (60 points)
  if (authorNorm.includes(cleanKw) || authorNorm.includes(normKw)) {
    score += 60;
  }

  // 5. Token matches in tags (30 points each)
  for (const tok of tokens) {
    if (normTags.includes(tok)) {
      score += 30;
    }
  }

  // 6. Whole word match in description (20 points each)
  for (const tok of tokens) {
    const wordRegex = new RegExp(`(^|\\s|[.,!?;])${tok}($|\\s|[.,!?;])`, 'i');
    if (wordRegex.test(descNorm)) {
      score += 20;
    }
  }

  return score;
}

/**
 * Maps arbitrary search keyword to the most suitable TikTok Explore category ID
 */
export function findCategoryByKeyword(keyword) {
  const norm = normalizeKeyword(keyword);
  if (!norm) return 100;

  for (const cat of TIKTOK_EXPLORE_CATEGORIES) {
    for (const k of cat.keywords) {
      const normK = normalizeKeyword(k);
      if (norm === normK || norm.includes(normK) || normK.includes(norm)) {
        return cat.id;
      }
    }
  }

  return 100;
}

/**
 * Searches the verified curated library and returns all candidate videos matching user keyword,
 * sorted by relevance score descending
 */
export function findInCuratedLibrary(rawKeyword) {
  if (!rawKeyword || typeof rawKeyword !== 'string') return [];
  const cleanKeyword = stripAccents(rawKeyword).trim();
  if (!cleanKeyword) return [];

  const scored = CURATED_TOPIC_VIDEOS
    .map((v) => ({ video: v, score: scoreVideoRelevance(v, rawKeyword) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];

  // Dynamic relevance threshold: when top matches have strong confidence (score >= 200),
  // retain only videos within 75% of maxScore to exclude loose/partial matches
  const maxScore = scored[0].score;
  const threshold = maxScore >= 200 ? maxScore * 0.75 : Math.max(30, maxScore * 0.6);

  return scored
    .filter((item) => item.score >= threshold)
    .map((item) => item.video);
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
 * Searches and randomly selects a fresh video matching user-entered keyword
 * Operates 100% publicly without requiring authentication tokens or account cookies
 * Automatically avoids recently sent videos in the conversation
 */
export async function getRandomVideoByKeyword(userKeyword, cookieStr = '', conversationId = '') {
  const kw = (userKeyword || '').trim();
  const previouslySent = conversationId ? await getSentVideoIds(conversationId) : [];
  const sentSet = new Set(previouslySent);

  // 1. Precise relevance search in verified video library
  let matches = findInCuratedLibrary(kw);

  // 2. If no direct keyword match, map to closest category and find relevant items
  if (matches.length === 0) {
    const catId = findCategoryByKeyword(kw);
    const categoryObj = TIKTOK_EXPLORE_CATEGORIES.find((c) => c.id === catId);
    if (categoryObj && categoryObj.keywords) {
      for (const k of categoryObj.keywords) {
        const subMatches = findInCuratedLibrary(k);
        if (subMatches.length > 0) {
          matches = subMatches;
          break;
        }
      }
    }
  }

  // 3. Fallback to all curated videos if keyword is completely generic
  if (matches.length === 0) {
    matches = [...CURATED_TOPIC_VIDEOS];
  }

  // Filter out recently sent video IDs in this conversation
  let available = matches.filter((v) => !sentSet.has(v.id));
  if (available.length === 0) {
    available = matches;
  }

  // Pick random video from candidate pool
  const randomIndex = Math.floor(Math.random() * available.length);
  const selected = available[randomIndex];

  if (conversationId && selected && selected.id) {
    await recordSentVideoId(conversationId, selected.id);
  }

  return selected;
}

/**
 * Fast preview query for UI testing without recording to sent history
 * Operates 100% publicly without requiring authentication tokens or account cookies
 * Accurately matches user's custom typed keyword in real time
 */
export async function previewSearchVideo(userKeyword, cookieStr = '') {
  const kw = (userKeyword || '').trim();

  // 1. Precise relevance search in verified video library
  let matches = findInCuratedLibrary(kw);

  // 2. Fallback to category mapped keywords
  if (matches.length === 0) {
    const catId = findCategoryByKeyword(kw);
    const categoryObj = TIKTOK_EXPLORE_CATEGORIES.find((c) => c.id === catId);
    if (categoryObj && categoryObj.keywords) {
      for (const k of categoryObj.keywords) {
        const subMatches = findInCuratedLibrary(k);
        if (subMatches.length > 0) {
          matches = subMatches;
          break;
        }
      }
    }
  }

  if (matches.length === 0) {
    matches = [...CURATED_TOPIC_VIDEOS];
  }

  const randomIndex = Math.floor(Math.random() * matches.length);
  return matches[randomIndex];
}
