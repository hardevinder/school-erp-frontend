import React, { useMemo, useState } from 'react';
import './SmartCampusHomepage.css';
import './SmartCampusPreview144.css';
// SMART_CAMPUS_MEDIA_1_4_1
import SmartCampusMediaPicker,{SmartCampusMediaThumb} from './SmartCampusMediaPicker';

const initialSections = [
  { key: 'hero', label: 'Hero & admissions', enabled: true, title: 'Welcome to our campus', body: 'Learn, explore and grow with us.' },
  { key: 'about', label: 'About our school', enabled: true, title: 'About our school', body: 'Introduce your school, its values and its learning environment.' },
  { key: 'principal', label: "Principal's message", enabled: true, title: "Principal's message", body: 'Add a welcome message from the principal.' },
  { key: 'gallery', label: 'Photo gallery', enabled: false, title: 'Campus life', body: 'Approved school photographs will appear here after media integration.' },
  { key: 'events', label: 'News & events', enabled: false, title: 'Latest updates', body: 'Approved events will appear here after ERP integration.' },
  { key: 'admissions', label: 'Admissions enquiry', enabled: true, title: 'Join our school', body: 'Explore admissions and contact our team.' },
];
const safeUrl = value => {
  const str = String(value || '').trim();
  if (!str || /[\\\x00-\x1f]/.test(str)) return '';
  return /^https:\/\/[^\s]+$/i.test(str) || /^\/(?!\/)[\w./%+()~-]+$/.test(str) ? str : '';
};
const cleanColor = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#771422';
// SMART_CAMPUS_PREVIEW_1_4_4: private live visual preview (no public delivery).
function ScHeroSlides({ ids, index, title, body, cta }) {
  const total = ids.length;
  return <div className="sc144-hero">
    {total > 0 && ids.map((id,i) => <div className={`sc144-hero-image ${i === index % total ? 'is-active' : ''}`} key={id} aria-hidden={i !== index % total}>
      <SmartCampusMediaThumb item={{id, name:'School hero banner'}} />
    </div>)}
    <div className="sc144-hero-shade" />
    <div className="sc144-hero-content"><h3>{title}</h3><p>{body}</p><span className="sch-preview-cta">{cta || 'Explore admissions'}</span></div>
    {total > 1 && <div className="sc144-slide-count" aria-live="polite">{index % total + 1} / {total}</div>}
  </div>;
}
function ScGalleryGrid({ids}) {
 return <div className="sc144-photo-grid">{ids.map((id,i) => <div key={id} className="sc144-photo" title={`Gallery photo ${i+1}`}><SmartCampusMediaThumb item={{id,name:`Gallery image ${i+1}`}} /></div>)}</div>;
}
export default function SmartCampusHomepage({ onSave, busy = false, school = null }) {
  const [sections, setSections] = useState(initialSections);
  const [brand, setBrand] = useState({ tagline: '', heroImage: '', cta: 'Explore admissions', color: '#771422', seoTitle: '', seoDescription: '', socialImage: '' });
  const [notice, setNotice] = useState('');
  const [fullPreview,setFullPreview]=useState(false);
  const [heroMedia,setHeroMedia]=useState([]);
  const [galleryMedia,setGalleryMedia]=useState([]);
  const [currentHero,setCurrentHero]=useState(0);
  const [duration,setDuration]=useState(5);
  const name = school?.name || 'Your School';
  const sectionList = useMemo(() => sections.filter(s => s.enabled), [sections]);
  React.useEffect(() => {
    if (heroMedia.length < 2 || !sections.some(s => s.key === 'hero' && s.enabled)) return undefined;
    const timer = window.setInterval(() => setCurrentHero(v => (v+1) % heroMedia.length), Math.max(2,Math.min(30,Number(duration)||5))*1000);
    return () => window.clearInterval(timer);
  }, [heroMedia.length, duration, sections]);
  React.useEffect(() => { setCurrentHero(v => heroMedia.length ? v % heroMedia.length : 0); }, [heroMedia.length]);
  const selectGallery = (ids) => {
    setGalleryMedia(ids);
    if (ids.length) setSections(prev => prev.map(s => s.key === 'gallery' ? {...s,enabled:true} : s));
  };
  const setSection = (key, field, value) => setSections(v => v.map(s => s.key === key ? { ...s, [field]: value } : s));
  const move = (key, offset) => setSections(old => {
    const from = old.findIndex(s => s.key === key), to = from + offset;
    if (to < 0 || to >= old.length) return old;
    const next = old.slice(); [next[from], next[to]] = [next[to], next[from]]; return next;
  });
  const save = async () => {
    setNotice('');
    const payload = {
      schema: 'edubridge.smartcampus.homepage.v1',
      school_name_snapshot: name,
      branding: { ...brand, heroImage: safeUrl(brand.heroImage), socialImage: safeUrl(brand.socialImage), color: cleanColor(brand.color) },
      sections: sections.map((s, order) => ({ ...s, order })),
      media: {hero:heroMedia,gallery:galleryMedia,slideSeconds:duration},
    };
    try { await onSave(payload); setNotice('Homepage review draft saved. Open All publications to review it.'); }
    catch (err) { setNotice(err?.response?.data?.message || err?.message || 'Could not save draft.'); }
  };
  return <div className="sch-root">
    <div className="sch-heading"><div><span>SMART CAMPUS · PATCH 1.4</span><h2>Dynamic homepage builder</h2><p>Configure the homepage in a private review draft. Nothing changes on the public website.</p></div><button className="scm-primary" type="button" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save as review draft'}</button></div>
    {notice && <p className="sch-notice" role="status">{notice}</p>}
    <div className="sch-grid"><div className="sch-controls">
      <h3>Branding & homepage</h3>
      <label>Tagline<input maxLength={130} value={brand.tagline} onChange={e => setBrand({ ...brand, tagline: e.target.value })} placeholder="Inspiring future leaders" /></label>
      <SmartCampusMediaPicker kind="hero" items={heroMedia} onChange={setHeroMedia} />
      <label>Image duration (seconds)<input type="number" min="2" max="30" value={duration} onChange={e=>setDuration(Math.max(2,Math.min(30,Number(e.target.value)||5)))} /></label>
      <SmartCampusMediaPicker kind="gallery" items={galleryMedia} onChange={selectGallery} />
      <label>Optional hero image URL (legacy)<input value={brand.heroImage} onChange={e => setBrand({ ...brand, heroImage: e.target.value })} placeholder="https://…" /></label>
      <label>Admissions button text<input maxLength={70} value={brand.cta} onChange={e => setBrand({ ...brand, cta: e.target.value })} /></label>
      <label>Theme colour<input type="color" value={cleanColor(brand.color)} onChange={e => setBrand({ ...brand, color: e.target.value })} /></label>
      <h3>Homepage sections</h3>
      {sections.map((s, index) => <div className="sch-section-editor" key={s.key}>
        <div className="sch-section-top"><label className="sch-toggle"><input type="checkbox" checked={s.enabled} onChange={e => setSection(s.key, 'enabled', e.target.checked)} /> {s.label}</label><div><button title="Move up" type="button" onClick={() => move(s.key, -1)} disabled={index === 0}>↑</button><button title="Move down" type="button" onClick={() => move(s.key, 1)} disabled={index === sections.length - 1}>↓</button></div></div>
        {s.enabled && <><label>Heading<input maxLength={180} value={s.title} onChange={e => setSection(s.key, 'title', e.target.value)} /></label><label>Text<textarea rows={3} maxLength={2000} value={s.body} onChange={e => setSection(s.key, 'body', e.target.value)} /></label></>}
      </div>)}
      <h3>SEO draft</h3><label>Page title<input maxLength={160} value={brand.seoTitle} onChange={e => setBrand({ ...brand, seoTitle: e.target.value })} placeholder={`${name} | Official Website`} /></label>
      <label>Meta description<textarea rows={3} maxLength={300} value={brand.seoDescription} onChange={e => setBrand({ ...brand, seoDescription: e.target.value })} /></label>
      <label>Social sharing image URL<input value={brand.socialImage} onChange={e => setBrand({ ...brand, socialImage: e.target.value })} placeholder="https://…" /></label>
    </div><div className={`sch-preview-wrap ${fullPreview ? "sc144-fullscreen" : ""}`}><div className="sc144-preview-toolbar"><div className="sch-preview-label">LIVE EDITOR PREVIEW · NOT PUBLICLY PUBLISHED</div><button type="button" onClick={() => setFullPreview(v => !v)}>{fullPreview ? "✕ Close full-screen preview" : "⛶ Full-screen website preview"}</button></div><div className="sch-preview" style={{ '--sch-color': cleanColor(brand.color) }}>
      <div className="sch-preview-nav"><strong>{name}</strong><span>{brand.tagline || 'School homepage preview'}</span></div>
      {sectionList.length ? sectionList.map(s => s.key === 'hero' ?
        <section key={s.key} className="sch-preview-section sch-preview-hero sc144-no-pad">
          <ScHeroSlides ids={heroMedia} index={currentHero} title={s.title} body={s.body} cta={brand.cta}/>
        </section> :
        <section key={s.key} className={`sch-preview-section sch-preview-${s.key}`}>
          <h3>{s.title}</h3><p>{s.body}</p>
          {s.key === 'gallery' && (galleryMedia.length ? <ScGalleryGrid ids={galleryMedia}/> : <small>Select gallery photos above to preview them here.</small>)}
          {s.key === 'admissions' && <span className="sch-preview-cta">{brand.cta || 'Explore admissions'}</span>}
          {s.key === 'events' && <small>ERP events integration is planned.</small>}
        </section>) : <p className="sch-empty">Enable a section to see the preview.</p>}
      <footer>{name} · Private preview</footer>
    </div><p className="sch-footnote">School profile values are shown as a snapshot. No live events, media uploads, admissions submission, public pages or SEO deployment are included in this patch.</p></div></div>
  </div>;
}
