import React from 'react';
import './SmartCampusBranding.css';

const TEXT_FIELDS = [
  ['name', 'School name'], ['description', 'About school'], ['phone', 'Contact phone'],
  ['email', 'Contact email'], ['website', 'Website URL'], ['address_line', 'Address'],
  ['tagline', 'Brand tagline'], ['logo', 'School logo URL/path'],
  ['favicon', 'Favicon URL/path'], ['banner_image', 'Hero/banner URL/path'],
  ['admission_cta', 'Admission button text'], ['primary_color', 'Primary theme colour']
];
export const parseBrand = (content) => {
  try { const obj = JSON.parse(content || '{}'); return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null; }
  catch (_) { return null; }
};
const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
const safeAsset = (value, base) => {
  const str = String(value || '').trim();
  if (!str || /[\\\x00-\x1F]/.test(str)) return '';
  if (/^https:\/\/[^\s]+$/i.test(str)) return str;
  if (/^\/(?!\/)[\w./%+()~-]+$/i.test(str)) return `${base || ''}${str}`;
  return '';
};
export function BrandingPreview({ data, base = '', compact = false }) {
  if (!data) return <p className="scb-hint">Branding preview is available for valid School Profile JSON.</p>;
  const primary = safeColor(data.primary_color, '#771422');
  const logo = safeAsset(data.logo, base);
  const banner = safeAsset(data.banner_image, base);
  const favicon = safeAsset(data.favicon, base);
  return <section className={`scb-preview ${compact ? 'scb-compact' : ''}`} aria-label="Private school branding preview" style={{ '--scb-primary': primary }}>
    <div className="scb-topline">PREVIEW ONLY · NOT A LIVE PUBLIC WEBSITE</div>
    <div className="scb-header">
      {logo ? <img src={logo} alt="School logo" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <span className="scb-logo-empty">🏫</span>}
      <div><strong>{data.name || 'School name'}</strong><small>{data.tagline || 'Add a school tagline in the review draft'}</small></div>
      {favicon && <img className="scb-favicon" src={favicon} alt="Favicon preview" onError={e => { e.currentTarget.style.display = 'none'; }} />}
    </div>
    <div className="scb-banner" style={banner ? { backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.67), rgba(0,0,0,.16)), url("${banner.replace(/["\\]/g, '')}")` } : {}}>
      <span>WELCOME TO OUR CAMPUS</span><h3>{data.name || 'Your school'}</h3>
      <p>{data.description ? String(data.description).slice(0, 240) : (data.tagline || 'A place to learn and grow.')}</p>
      <div className="scb-cta">{data.admission_cta || 'Explore admissions'}</div>
    </div>
    <div className="scb-contacts"><span>📍 {data.address_line || 'School address not available'}</span><span>☎ {data.phone || 'Phone not available'}</span><span>✉ {data.email || 'Email not available'}</span></div>
    <p className="scb-hint">Logo and contact information are copied from ERP. Favicon, hero banner, colours and tagline can be proposed in the review draft; publishing to the public website is not enabled.</p>
  </section>;
}
export function BrandingFields({ value, onChange }) {
  const data = parseBrand(value);
  if (!data) return <p className="scb-error">This draft is not valid JSON. Correct the JSON before editing branding fields.</p>;
  const update = (key, val) => onChange(JSON.stringify({ ...data, [key]: val }, null, 2));
  return <div className="scb-fields"><h3>School branding settings (review draft)</h3><p>These edits affect only this approval draft—not the original ERP school record.</p>
    <div className="scb-field-grid">{TEXT_FIELDS.map(([key, label]) => <label key={key}>{label}{key === 'description' ? <textarea rows={3} value={String(data[key] ?? '')} onChange={e => update(key, e.target.value)} /> : <input type="text" value={String(data[key] ?? '')} onChange={e => update(key, e.target.value)} placeholder={['logo','favicon','banner_image'].includes(key) ? 'https://… or /uploads/…' : ''} />}</label>)}</div>
    <p className="scb-hint">Use HTTPS image links or root-relative image paths. Theme colour format: #771422. Media is referenced, not uploaded, by this patch.</p>
    <BrandingPreview data={data} />
  </div>;
}
