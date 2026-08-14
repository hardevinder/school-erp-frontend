import api from "../api";
const BASE="/lost-found";
const unwrap=(r)=>r?.data||{};
export const lostFoundApi={
  capabilities:async()=>unwrap(await api.get(`${BASE}/capabilities`)),
  items:async(params={})=>unwrap(await api.get(`${BASE}/items`,{params})),
  dashboard:async()=>unwrap(await api.get(`${BASE}/dashboard`)),
  createItem:async(form)=>unwrap(await api.post(`${BASE}/items`,form,{headers:{"Content-Type":"multipart/form-data"}})),
  imageBlob:async(id)=>(await api.get(`${BASE}/items/${id}/image`,{responseType:"blob"})).data,
  claim:async(id,payload)=>unwrap(await api.post(`${BASE}/items/${id}/claims`,payload)),
  myClaims:async()=>unwrap(await api.get(`${BASE}/my-claims`)),
  claims:async(status="pending")=>unwrap(await api.get(`${BASE}/claims`,{params:{status}})),
  reviewClaim:async(id,payload)=>unwrap(await api.patch(`${BASE}/claims/${id}/review`,payload)),
  updateStatus:async(id,payload)=>unwrap(await api.patch(`${BASE}/items/${id}/status`,payload)),
  matches:async(itemId)=>unwrap(await api.get(`${BASE}/matches`,{params:{item_id:itemId}})),
};
export default lostFoundApi;
