/**
 * Session extracted directly from native TikTok Android App (com.ss.android.ugc.trill).
 * Source: /data/data/com.ss.android.ugc.trill/shared_prefs/ttnetCookieStore.xml
 */
export const REAL_APP_SESSION = {
  uid: "7074906265289769986",
  token: "03a142bb1563ebfd80e821fa2fd7189d4505974af3d2c405ba84b1b8929919f0eeff4ae7038204d51cff1b2cf546a083d9ca8c56f2b66c8704b172bae895b766f138f544a71cbc39ea5afab4cc7c0e8954d735bffdfa2685c25c28cb6f8141298e504--0a4e0a201ee861fab02769ff8ee24c1b8795bd8c2668c9014cf92a1342a423edd19e6ac21220f494c56dba83b3a606cdbcef6838fe8fd749e428b210324d6a03a561e0ff6f681801220674696b746f6b-3.0.1",
  cookies: {
    "sessionid": "a142bb1563ebfd80e821fa2fd7189d45",
    "sid_tt": "a142bb1563ebfd80e821fa2fd7189d45",
    "multi_sids": "7074906265289769986:100374711be130bcdff0539c465ca8f0",
    "uid_tt": "545e4ce7de6090c7f61b8343cfcb8131441c1bddf91fd58494091cc2131fcc01",
    "d_ticket": "ce127e25894426e515a077ae444989f0dbe2a",
    "cmpl_token": "AgQYAPOF_hfkT_2yEfNkAfqdO_Cz0E6Fkv-2DmCkXWk",
    "store-idc": "alisg",
    "tt-target-idc": "alisg",
    "odin_tt": "1cc9dfcd11309a24f4a611505ac1d57d46bca4434dcc909435a17fbbd09a54db1117090726e0707eeca0a637a48bda97611a9d627c18019c3d03d5e236e7204d2fc10a4aa520e717fb20e5bdb432ca4c",
    "sid_guard": "a142bb1563ebfd80e821fa2fd7189d45|1792168166|15551999|Wed,+14-Apr-2027+16:29:25+GMT"
  },
  userInfo: {
    nickname: "RainX",
    uniqueId: "rainxedm2107"
  }
};

export function getRealAppCookieString() {
  return Object.entries(REAL_APP_SESSION.cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}
