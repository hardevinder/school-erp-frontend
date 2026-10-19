import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import './SmartCampusMediaPicker.css';

// Patch 1.4.2: build on the private upload endpoints from Patch 1.4.1.
const BASE = (process.env.REACT_APP_API_URL || axios.defaults.baseURL || '').replace(/\/$/, '');
const ROOT = `${BASE}/api/smart-campus/media`;
const token = () => localStorage.getItem('token') || sessionStorage.getItem('token');
function headers() {
  const b = localStorage.getItem('selectedBranchId') || localStorage.getItem('branchId') || sessionStorage.getItem('selectedBranchId');
  return { Authorization: `Bearer ${token()}`, ...(b && Number(b) > 0 ? { 'X-Branch-Id': b } : {}) };
}
const call = (method, url, data, more = {}) => axios({ method, url: ROOT + url, data, headers: headers(), ...more });
const same = (a, b) => String(a) === String(b);

function Thumb({ item }) {
  const [url, setUrl] = useState('');
  const [mime, setMime] = useState(item.mime || '');
  useEffect(() => {
    let active = true;
    let object = '';
    setUrl('');
    call('get', '/' + encodeURIComponent(item.id) + '/file', null, { responseType: 'blob' })
      .then(r => {
        object = URL.createObjectURL(r.data);
        if (active) { setUrl(object); setMime(r.data.type || item.mime || ''); }
        else URL.revokeObjectURL(object);
      }).catch(() => {});
    return () => { active = false; if (object) URL.revokeObjectURL(object); };
  }, [item.id, item.mime]);
  if (!url) return <span className="sc-media-loading">Loading preview…</span>;
  return mime.startsWith('video/')
    ? <video src={url} controls preload="metadata" playsInline />
    : <img src={url} alt={item.name || 'School media'} />;
}

export default function SmartCampusMediaPicker({ items = [], onChange, kind = 'hero' }) {
  const [library, setLibrary] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [overUpload, setOverUpload] = useState(false);
  const [overId, setOverId] = useState(null);
  const [progress, setProgress] = useState(null);
  const inputRef = useRef(null);
  const uploadDepth = useRef(0);
  const dragId = useRef(null);
  const touchId = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const kindTitle = kind === 'hero' ? 'Hero banner media' : 'Photo & video gallery';

  useEffect(() => {
    let alive = true;
    call('get', '').then(r => { if (alive) setLibrary(r.data.items || []); })
      .catch(e => { if (alive) setNote(e.response?.data?.message || 'Could not load media library'); });
    return () => { alive = false; };
  }, []);

  function reorder(fromId, toId) {
    if (fromId == null || toId == null || same(fromId, toId)) return;
    const order = [...itemsRef.current];
    const start = order.findIndex(id => same(id, fromId));
    const end = order.findIndex(id => same(id, toId));
    if (start < 0 || end < 0) return;
    const [moved] = order.splice(start, 1);
    order.splice(end, 0, moved);
    onChange(order);
  }
  function move(index, offset) {
    const order = [...itemsRef.current];
    const end = index + offset;
    if (end < 0 || end >= order.length) return;
    [order[index], order[end]] = [order[end], order[index]];
    onChange(order);
  }
  async function uploadFiles(rawFiles) {
    const files = Array.from(rawFiles || []);
    if (!files.length) return;
    if (busy) { setNote('Please wait for the current upload to finish.'); return; }
    setNote('');
    if (files.length > 12) { setNote('Upload up to 12 files at once; repeat to add more.'); return; }
    const invalid = files.find(f => !['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(f.type)
      || f.size > (f.type.startsWith('video/') ? 60 : 12) * 1024 * 1024);
    if (invalid) { setNote('Allowed: JPG/PNG/WebP (12 MB each), MP4/WebM (60 MB each).'); return; }
    const data = new FormData();
    files.forEach(f => data.append('files', f));
    setBusy(true); setProgress(0);
    try {
      const response = await call('post', '', data, {
        onUploadProgress: e => {
          if (e.total) setProgress(Math.min(100, Math.round(e.loaded * 100 / e.total)));
        }
      });
      const uploaded = response.data.items || [];
      setLibrary(previous => [...previous, ...uploaded]);
      const additions = uploaded.map(x => x.id).filter(id => !itemsRef.current.some(selected => same(selected, id)));
      onChange([...itemsRef.current, ...additions]);
      setNote(`${uploaded.length} file(s) uploaded privately. Save as review draft to preserve selection.`);
    } catch (error) {
      setNote(error.response?.data?.message || 'Upload failed. Please try again.');
    } finally { setBusy(false); setProgress(null); }
  }
  const isFileDrag = e => Array.from(e.dataTransfer?.types || []).includes('Files');
  const handleFileDrop = e => {
    e.preventDefault(); e.stopPropagation();
    setOverUpload(false); uploadDepth.current = 0;
    if (isFileDrag(e)) uploadFiles(e.dataTransfer.files);
  };
  const chosen = items.map(id => library.find(x => same(x.id, id))).filter(Boolean);
  const available = library.filter(x => !items.some(id => same(id, x.id)));
  return (
    <div className="sc-media-box">
      <h4>{kindTitle}</h4>
      <p>Drop photos and videos here, or browse to select multiple files. Drag thumbnails to rearrange. Private preview only.</p>
      <div
        className={`sc-media-dropzone ${overUpload ? 'sc-media-dropzone-active' : ''} ${busy ? 'sc-media-dropzone-busy' : ''}`}
        onDragEnter={e => { if (!isFileDrag(e)) return; e.preventDefault(); uploadDepth.current += 1; setOverUpload(true); }}
        onDragOver={e => { if (isFileDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = busy ? 'none' : 'copy'; } }}
        onDragLeave={e => { if (!isFileDrag(e)) return; e.preventDefault(); uploadDepth.current = Math.max(0, uploadDepth.current - 1); if (!uploadDepth.current) setOverUpload(false); }}
        onDrop={handleFileDrop}
      >
        <span aria-hidden="true" className="sc-media-drop-icon">＋</span>
        <strong>Drag & drop photos or videos</strong>
        <span>JPG, PNG, WebP, MP4, WebM • 12 files per batch</span>
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>Browse files</button>
        <input ref={inputRef} type="file" multiple disabled={busy}
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          aria-label={`Select photos or videos for ${kindTitle}`}
          onChange={e => { const files = e.target.files; uploadFiles(files); e.target.value = ''; }} />
      </div>
      {busy && <div className="sc-media-progress" role="status" aria-live="polite">
        <span>Uploading{progress == null ? '…' : `: ${progress}%`}</span>
        <progress max="100" value={progress == null ? undefined : progress} />
      </div>}
      {note && <p role="status" aria-live="polite" className="sc-media-note">{note}</p>}
      {chosen.length > 0 && <p className="sc-media-order-hint">Drag a media card to a new position. On touchscreens, drag the handle or use the arrow buttons.</p>}
      <div className="sc-media-list sc-media-sortable" aria-label={`${kindTitle} order`}>
        {chosen.map((x, i) => <div key={x.id} data-sc-media-id={String(x.id)}
          className={`sc-media-item ${overId != null && same(overId, x.id) ? 'sc-media-reorder-target' : ''}`}
          draggable={!busy}
          onDragStart={e => { dragId.current = x.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(x.id)); }}
          onDragOver={e => { if (dragId.current == null) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setOverId(x.id); }}
          onDrop={e => { if (dragId.current == null) return; e.preventDefault(); e.stopPropagation(); reorder(dragId.current, x.id); dragId.current = null; setOverId(null); }}
          onDragEnd={() => { dragId.current = null; setOverId(null); }}
          onTouchStart={() => { touchId.current = x.id; }}
          onTouchEnd={e => { const point = e.changedTouches?.[0]; const origin = touchId.current; touchId.current = null; if (!point) return; const target = document.elementFromPoint(point.clientX, point.clientY)?.closest('[data-sc-media-id]'); if (target) reorder(origin, target.getAttribute('data-sc-media-id')); }}
        >
          <div className="sc-media-drag-handle" title="Drag to reorder" aria-hidden="true">⠿ Drag to reorder</div>
          <Thumb item={x} />
          <span title={x.name}>{x.name}</span>
          <div className="sc-media-item-actions">
            <button type="button" aria-label={`Move ${x.name} earlier`} onClick={() => move(i, -1)} disabled={busy || i === 0}>↑</button>
            <button type="button" aria-label={`Move ${x.name} later`} onClick={() => move(i, 1)} disabled={busy || i === chosen.length - 1}>↓</button>
            <button type="button" onClick={() => onChange(itemsRef.current.filter(id => !same(id, x.id)))} disabled={busy}>Remove</button>
          </div>
        </div>)}
      </div>
      {!!available.length && <details><summary>Choose from media library ({available.length})</summary>
        <div className="sc-media-list">{available.map(x => <button key={x.id} className="sc-media-library" type="button" onClick={() => onChange([...itemsRef.current, x.id])} disabled={busy}>
          <Thumb item={x} /><span>＋ {x.name}</span>
        </button>)}</div>
      </details>}
      <p className="sc-media-help">Removing media from this section does not delete the uploaded file. The revised order is stored when you save the review draft.</p>
    </div>
  );
}
export { Thumb as SmartCampusMediaThumb };
