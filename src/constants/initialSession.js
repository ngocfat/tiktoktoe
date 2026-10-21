/**
 * Session mặc định đã trích xuất từ test_webview_login.py
 * Cho phép dùng ngay lập tức mà không cần quét lại mã QR nếu cookie còn hạn.
 */
export const DEFAULT_SESSION_COOKIES = {
  "_ttp": "3DevJxoEsy9eLGZARvyzgTGnnaL",
  "tt_csrf_token": "AOTHeBwv-KrwZKCZ10Exyc2cHzahd_Yvblis",
  "s_v_web_id": "verify_mvdtz35e_rRbVtMFo_UVko_4mkl_82ZC_m82m3JwxpnR5",
  "d_ticket": "82197706bd186fc9e6c9f41642f595b2da3a4",
  "multi_sids": "7257962282297721861%3A0899f05eaede0a1e7a58606ed1d88be9",
  "cmpl_token": "AgQYAPOF_hfkTtK0h5iaRbjdPPBCREqCCT-WDmCkSP0",
  "passport_auth_status": "f684e62978da39d9089468d33f4a4ea5%2Cf026ffd357766c77a0f5845e68f284a1",
  "passport_auth_status_ss": "f684e62978da39d9089468d33f4a4ea5%2Cf026ffd357766c77a0f5845e68f284a1",
  "sid_guard": "1fb4b01ea385f7ba0a77d219946ea221%7C1792328272%7C15551999%7CFri%2C+16-Apr-2027+12%3A57%3A51+GMT",
  "uid_tt": "4736630f84b52f19008bba9ac5b787ece822ff456043133694c4a97f43be5cca",
  "uid_tt_ss": "4736630f84b52f19008bba9ac5b787ece822ff456043133694c4a97f43be5cca",
  "sid_tt": "1fb4b01ea385f7ba0a77d219946ea221",
  "sessionid": "1fb4b01ea385f7ba0a77d219946ea221",
  "sessionid_ss": "1fb4b01ea385f7ba0a77d219946ea221",
  "tt_session_tlb_tag": "sttt%7C5%7CH7SwHqOF97oKd9IZlG6iIf________-vaK0Cy_jJ5Hq4kSWzUr4mFzxObDDfkG5_6Ua53yV-Dq0%3D",
  "sid_ucp_v1": "1.0.1-KDYzNmI1NjZmODViZjJmYTFmNzEyMzI0N2E5YTE1YTI1ZGMwZjU1NjMKIgiFiKjs3Mfd3GQQ0ITT1gYYswsgDDDg7OWlBjgCQPEHSAQQAxoCbXkiIDFmYjRiMDFlYTM4NWY3YmEwYTc3ZDIxOTk0NmVhMjIxMk4KIKwaY--AkFnNJrME6gEnst28jgy5nCZ4-Yq576cFPVtvEiCQpA2lWA_5dxUXwPiHGHn1jvxYuk4ZHiatliAI2PYScBgEIgZ0aWt0b2s",
  "ssid_ucp_v1": "1.0.1-KDYzNmI1NjZmODViZjJmYTFmNzEyMzI0N2E5YTE1YTI1ZGMwZjU1NjMKIgiFiKjs3Mfd3GQQ0ITT1gYYswsgDDDg7OWlBjgCQPEHSAQQAxoCbXkiIDFmYjRiMDFlYTM4NWY3YmEwYTc3ZDIxOTk0NmVhMjIxMk4KIKwaY--AkFnNJrME6gEnst28jgy5nCZ4-Yq576cFPVtvEiCQpA2lWA_5dxUXwPiHGHn1jvxYuk4ZHiatliAI2PYScBgEIgZ0aWt0b2s",
  "store-idc": "alisg",
  "store-country-code": "vn",
  "store-country-code-src": "uid",
  "tt-target-idc": "alisg",
  "tt_chain_token": "Hj4itESeArpf0BXSAvVV8g==",
  "store-country-sign": "MEIEDCt0bSIdHX32igtCWQQgMG2YGc9rWjowzrXi9QAb5FesAgvieF50UqArSjQlOMcEEFkJUNJ3Xrai783omVkqp68",
  "odin_tt": "0e48d245e27ad635ecf97118969f62b3e19608a1c37a94c2f717a96d3290613edba6d3dfb7a529c22dc247b248db1d29019570007d6caf289317989389a5b26005cb3bd65f0d78b07fb46c1013a3877e",
  "ttwid": "1%7C5Fw8xxXxotREDYsR3x-al2ECqE_lU7NotxWsEEgoSTs%7C1792334862%7Cc2059f558d53cc98fce9dc727b4467540b15398a55a83ba1ca43150bc141aaaa",
  "msToken": "ymUb9IYpm2pF1HQc-W0i8ODCQiFd0zs51GOd0UsM0BUdCg-MA-wLEFV8X9xOTi7ekv_-tdQ-DSPlEmHPYyIvcITYw8F8SY03q3QJrLxH0mgbuJDyJoVG-JVxlczD2pxj6fKSUyR4M8HO7Npxm4fQXDhxV1u-zaL4_H0ANUU="
};

export function cookieObjToString(cookieObj) {
  if (!cookieObj) return '';
  return Object.entries(cookieObj)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}
