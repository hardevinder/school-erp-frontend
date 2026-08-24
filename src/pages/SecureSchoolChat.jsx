import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Form, Modal, Spinner } from "react-bootstrap";
import { useSearchParams } from "react-router-dom"; // SCHOOL_CHAT_FLOATING_V16_2_SEARCHPARAMS
import api from "../api";
import socket, { refreshSocketAuth } from "../socket";
import "./SecureSchoolChat.css";

const fmt = (v) => v ? new Date(v).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "";
const fmtSeen = (v) => v ? new Date(v).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "";
const nonce = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const getRoles = () => {
  const raw = localStorage.getItem("roles") || sessionStorage.getItem("roles") || "[]";
  try { const x=JSON.parse(raw); return Array.isArray(x)?x.map(v=>String(v).toLowerCase()):[]; } catch { return []; }
};

export default function SecureSchoolChat() {
  const [searchParams] = useSearchParams(); // SCHOOL_CHAT_FLOATING_V16_2_DEEPLINK_STATE
  const deepLinkOpenedRef = useRef(null);
  const roles = useMemo(getRoles, []);
  const [threads,setThreads]=useState([]), [recipients,setRecipients]=useState([]), [active,setActive]=useState(null), [messages,setMessages]=useState([]);
  const [loading,setLoading]=useState(true), [threadLoading,setThreadLoading]=useState(false), [sending,setSending]=useState(false), [text,setText]=useState("");
  const [files,setFiles]=useState([]), [typing,setTyping]=useState(""), [showNew,setShowNew]=useState(false), [recipientKey,setRecipientKey]=useState("");
  const [search,setSearch]=useState(""), [error,setError]=useState("");
  const activeRef=useRef(null), typingTimer=useRef(null), endRef=useRef(null);

  const loadThreads=async()=>{ try{const r=await api.get("/api/school-chat/threads");setThreads(r.data?.threads||[]);}catch(e){setError(e?.response?.data?.message||e.message);}finally{setLoading(false);} };
  const loadRecipients=async()=>{try{const r=await api.get("/api/school-chat/recipients");setRecipients(r.data?.recipients||[]);}catch(e){console.warn(e);} };
  const openThread=async(t)=>{
    if(activeRef.current?.id) socket.emit("schoolchat:leave",{threadId:activeRef.current.id});
    setActive(t); activeRef.current=t; setThreadLoading(true); setTyping("");
    try{
      const r=await api.get(`/api/school-chat/threads/${t.id}/messages`,{params:{limit:80}}); const list=r.data?.messages||[]; setMessages(list);
      const latest=list[list.length-1]; socket.emit("schoolchat:join",{threadId:t.id,uptoMessageId:latest?.id},()=>{});
      if(latest && !latest.own) socket.emit("schoolchat:seen",{threadId:t.id,messageId:latest.id},()=>{});
      setThreads(prev=>prev.map(x=>x.id===t.id?{...x,unreadCount:0}:x));
    }catch(e){setError(e?.response?.data?.message||e.message);}finally{setThreadLoading(false);setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),50);}
  };
  const refreshActive=async()=>{ if(!activeRef.current?.id)return; try{const r=await api.get(`/api/school-chat/threads/${activeRef.current.id}/messages`,{params:{limit:80}});setMessages(r.data?.messages||[]);}catch(_){} };

  // SCHOOL_CHAT_FLOATING_V16_2_DEEPLINK_EFFECT
  useEffect(()=>{
    const targetId=Number(searchParams.get("threadId"));
    if(!targetId||deepLinkOpenedRef.current===targetId||!threads.length)return;
    const target=threads.find(t=>Number(t.id)===targetId);
    if(target){deepLinkOpenedRef.current=targetId;openThread(target);}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[threads,searchParams]);

  useEffect(()=>{
    refreshSocketAuth(); loadThreads(); loadRecipients();
    const onMsg=({threadId,message})=>{
      if(Number(activeRef.current?.id)===Number(threadId)){
        setMessages(prev=>prev.some(m=>Number(m.id)===Number(message.id))?prev:[...prev,message]);
        if(!message.own) socket.emit("schoolchat:seen",{threadId,messageId:message.id},()=>{});
        setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),20);
      }
      loadThreads();
    };
    const onUpdate=()=>loadThreads();
    const onTyping=(p)=>{if(Number(activeRef.current?.id)===Number(p.threadId))setTyping(p.isTyping?`${p.name||"Someone"} is typing…`:"");};
    const onSeen=(p)=>{if(Number(activeRef.current?.id)===Number(p.threadId))refreshActive();};
    const onDelivered=(p)=>{if(Number(activeRef.current?.id)===Number(p.threadId))refreshActive();};
    const onPresence=(p)=>{
      const key=p?.identity?.studentId?`student:${p.identity.studentId}`:`user:${p?.identity?.userId}`;
      setThreads(prev=>prev.map(t=>{const o=t.otherParticipant||{};const k=o.kind==="student"?`student:${o.id}`:`user:${o.id}`;return k===key?{...t,online:!!p.online}:t;}));
      setActive(prev=>{if(!prev)return prev;const o=prev.otherParticipant||{};const k=o.kind==="student"?`student:${o.id}`:`user:${o.id}`;return k===key?{...prev,online:!!p.online}:prev;});
    };
    socket.on("schoolchat:message",onMsg); socket.on("schoolchat:thread-updated",onUpdate); socket.on("schoolchat:typing",onTyping); socket.on("schoolchat:seen",onSeen); socket.on("schoolchat:delivered",onDelivered); socket.on("schoolchat:presence-changed",onPresence);
    return()=>{socket.off("schoolchat:message",onMsg);socket.off("schoolchat:thread-updated",onUpdate);socket.off("schoolchat:typing",onTyping);socket.off("schoolchat:seen",onSeen);socket.off("schoolchat:delivered",onDelivered);socket.off("schoolchat:presence-changed",onPresence);if(activeRef.current?.id)socket.emit("schoolchat:leave",{threadId:activeRef.current.id});};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const sendTyping=(value)=>{setText(value);if(!activeRef.current?.id)return;socket.emit("schoolchat:typing",{threadId:activeRef.current.id,isTyping:true});clearTimeout(typingTimer.current);typingTimer.current=setTimeout(()=>socket.emit("schoolchat:typing",{threadId:activeRef.current?.id,isTyping:false}),900);};
  const send=async()=>{
    if(!active?.id||(!text.trim()&&!files.length))return; setSending(true);setError("");
    try{
      if(files.length){const fd=new FormData();fd.append("body",text.trim());files.forEach(f=>fd.append("files",f));await api.post(`/api/school-chat/threads/${active.id}/attachment-message`,fd,{headers:{"Content-Type":"multipart/form-data"}});setFiles([]);setText("");}
      else{
        const body=text.trim();setText("");
        await new Promise((resolve,reject)=>socket.emit("schoolchat:send",{threadId:active.id,body,clientNonce:nonce()},(ack)=>ack?.ok?resolve(ack):reject(new Error(ack?.message||"Send failed"))));
      }
      socket.emit("schoolchat:typing",{threadId:active.id,isTyping:false});
    }catch(e){setError(e?.response?.data?.message||e.message);}finally{setSending(false);}
  };
  const quickThumbsUp=async()=>{
    if(!active?.id||sending)return;setSending(true);setError("");
    try{
      await new Promise((resolve,reject)=>socket.emit("schoolchat:send",{threadId:active.id,body:"👍",clientNonce:nonce()},(ack)=>ack?.ok?resolve(ack):reject(new Error(ack?.message||"Send failed"))));
    }catch(e){setError(e?.response?.data?.message||e.message);}finally{setSending(false);}
  };
  const startChat=async()=>{
    const [kind,id]=recipientKey.split(":"); if(!kind||!id)return;
    try{const r=await api.post("/api/school-chat/threads",{kind,id:Number(id)});setShowNew(false);setRecipientKey("");await loadThreads();openThread(r.data.thread);}catch(e){setError(e?.response?.data?.message||e.message);}
  };
  const download=async(a)=>{try{const r=await api.get(a.downloadUrl,{responseType:"blob"});const url=URL.createObjectURL(r.data);const w=window.open(url,"_blank","noopener,noreferrer");if(!w){const el=document.createElement("a");el.href=url;el.download=a.name||"attachment";el.click();}setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(e){setError("Unable to open attachment.");}};

  const filtered=threads.filter(t=>!search.trim()||`${t.otherParticipant?.name||""} ${t.lastMessage?.body||""}`.toLowerCase().includes(search.toLowerCase()));
  const grouped=recipients.reduce((m,r)=>{const g=r.group||"People";(m[g] ||= []).push(r);return m;},{});
  const status=(m)=>m.deliveryStatus==="seen"?"Seen":m.deliveryStatus==="delivered"?"Delivered":"Sent";
  const seenAt=(m)=>m.deliveryStatus==="seen"?(m.receipts||[]).map(r=>r.seenAt).filter(Boolean).sort().at(-1):null;

  return <div className="school-chat-page">
    <div className="school-chat-head"><div><h2>Secure School Chat</h2><p>Realtime school communication • attachments • typing • delivered & seen</p></div><div className="d-flex gap-2 align-items-center"><Badge bg="success">Socket Realtime</Badge><Button onClick={()=>setShowNew(true)}>New Chat</Button></div></div>
    {error&&<div className="alert alert-danger py-2">{error}</div>}
    <div className="school-chat-shell">
      <aside className="school-chat-list">
        <div className="p-3 border-bottom"><Form.Control size="sm" placeholder="Search chats…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        {loading?<div className="p-4 text-center"><Spinner/></div>:filtered.length?filtered.map(t=><button key={t.id} className={`chat-thread-row ${active?.id===t.id?"active":""}`} onClick={()=>openThread(t)}>
          <div className="chat-avatar">{(t.otherParticipant?.name||"?").slice(0,1).toUpperCase()}<span className={`presence-dot ${t.online?"online":""}`}/></div>
          <div className="min-w-0"><div className="d-flex justify-content-between"><b className="text-truncate">{t.otherParticipant?.name||"Chat"}</b><small>{fmt(t.lastMessageAt)}</small></div><div className="text-muted small text-truncate">{t.lastMessage?.body||"Start conversation"}</div></div>
          {!!t.unreadCount&&<span className="chat-unread">{t.unreadCount}</span>}
        </button>):<div className="p-4 text-muted text-center">No chats yet.</div>}
      </aside>
      <main className="school-chat-main">
        {!active?<div className="chat-empty"><div>💬</div><h4>Secure School Chat</h4><p>Select a conversation or start a new one.</p><small>{roles.includes("student")?"Students can chat with assigned teachers and authorized school staff.":"Communication is controlled by school roles and assignments."}</small></div>:<>
          <header className="chat-active-head"><div className="chat-avatar large">{(active.otherParticipant?.name||"?").slice(0,1).toUpperCase()}<span className={`presence-dot ${active.online?"online":""}`}/></div><div><b>{active.otherParticipant?.name}</b><div className="small text-muted">{active.online?"Online":"Offline"} • {(active.otherParticipant?.roles||[]).join(", ")}</div></div></header>
          <section className="chat-messages">{threadLoading?<div className="text-center p-5"><Spinner/></div>:messages.map(m=>{const readAt=seenAt(m);return <div key={m.id} className={`chat-message ${m.own?"mine":"theirs"}`}><div className="chat-bubble">{!m.own&&<div className="chat-sender">{m.sender?.name}</div>}<div>{m.body}</div>{m.attachments?.map(a=><button key={a.id} className="attachment-chip" onClick={()=>download(a)}>📎 {a.name}</button>)}<div className="chat-meta">{fmt(m.createdAt)} {m.own&&<>• {readAt?`Seen at ${fmtSeen(readAt)}`:status(m)}</>}</div></div></div>})}<div ref={endRef}/></section>
          <div className="typing-line">{typing}</div>
          <footer className="chat-compose"><Form.Control type="file" multiple size="sm" onChange={e=>setFiles(Array.from(e.target.files||[]))}/>{files.length>0&&<div className="small text-muted mt-1">{files.map(f=>f.name).join(", ")}</div>}<div className="d-flex gap-2 mt-2"><Button variant="outline-secondary" title="Quick thumbs up" aria-label="Send thumbs up" disabled={sending} onClick={quickThumbsUp}>👍</Button><Form.Control as="textarea" rows={2} placeholder="Type a message…" value={text} onChange={e=>sendTyping(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}/><Button disabled={sending||(!text.trim()&&!files.length)} onClick={send}>{sending?<Spinner size="sm"/>:"Send"}</Button></div></footer>
        </>}
      </main>
    </div>
    <Modal show={showNew} onHide={()=>setShowNew(false)} centered><Modal.Header closeButton><Modal.Title>Start Secure Chat</Modal.Title></Modal.Header><Modal.Body><Form.Label>Allowed recipient</Form.Label><Form.Select value={recipientKey} onChange={e=>setRecipientKey(e.target.value)}><option value="">Select…</option>{Object.entries(grouped).map(([g,rows])=><optgroup label={g} key={g}>{rows.map(r=><option key={`${r.kind}:${r.id}`} value={`${r.kind}:${r.id}`}>{r.name}{r.username?` — ${r.username}`:""}</option>)}</optgroup>)}</Form.Select><div className="small text-muted mt-2">Student-to-student chat is blocked by the backend. Teachers can message only assigned students; authorities can initiate chats with teachers.</div></Modal.Body><Modal.Footer><Button variant="secondary" onClick={()=>setShowNew(false)}>Cancel</Button><Button disabled={!recipientKey} onClick={startChat}>Start Chat</Button></Modal.Footer></Modal>
  </div>;
}
