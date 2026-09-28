import { applyPortalTheme, DEFAULT_PORTAL_THEME, normalizePortalTheme, contrastRatio } from './portalThemeRuntime';

const value = (name) => document.documentElement.style.getPropertyValue(`--edb-${name}`);
afterEach(() => { document.documentElement.removeAttribute('style'); });

test('rejects invalid stored colors and accepts partial institution themes', () => {
  expect(normalizePortalTheme(null)).toEqual(DEFAULT_PORTAL_THEME);
  expect(normalizePortalTheme({ primary: 'url(bad)', accent: '#ABCDEF' })).toEqual({
    ...DEFAULT_PORTAL_THEME, accent: '#abcdef',
  });
});

test('theme switching and reset replace every semantic and compatibility token', () => {
  applyPortalTheme({ primary: '#164e8a', accent: '#d6a84b' });
  expect(value('primary')).toBe('#164e8a');
  expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('#164e8a');
  expect(value('saved-primary')).toBe('#164e8a');
  const blueSoft = value('primary-soft');
  applyPortalTheme({ primary: '#12634a', accent: '#d3a93f' });
  expect(value('primary')).toBe('#12634a');
  expect(value('primary-soft')).not.toBe(blueSoft);
  ['primary', 'primary-dark', 'accent', 'dashboard-bg', 'surface', 'text', 'muted-text',
    'border', 'sidebar-bg', 'sidebar-text', 'input-text', 'primary-soft'].forEach((key) => {
    expect(value(key)).toMatch(/^#[a-f\d]{6}$/i);
  });
  applyPortalTheme();
  expect(value('primary')).toBe(DEFAULT_PORTAL_THEME.primary);
});

test.each([
  { surface: '#ffffff', text: '#ffffff', inputText: '#eeeeee', sidebarBg: '#111111', sidebarText: '#111111', primary: '#eeeeee', primaryDark: '#ffffff' },
  { surface: '#111111', text: '#111111', inputText: '#222222', sidebarBg: '#ffffff', sidebarText: '#ffffff', primary: '#111111', primaryDark: '#000000' },
  { primary: '#12634a', surface: '#fffdfa', text: '#261f1d' },
])('keeps text readable even when configured foregrounds have low contrast: %j', (theme) => {
  applyPortalTheme(theme);
  [['text', 'surface'], ['input-text', 'surface'], ['muted-text', 'surface'],
    ['sidebar-text', 'sidebar-bg'], ['on-primary', 'primary'], ['on-primary-dark', 'primary-dark'],
    ['primary-text', 'surface'], ['on-primary-soft', 'primary-soft']].forEach(([fg, bg]) => {
    expect(contrastRatio(value(fg), value(bg))).toBeGreaterThanOrEqual(4.5);
  });
});

test('readability adjustments do not overwrite the saved theme or settings preview values', () => {
  const theme = { ...DEFAULT_PORTAL_THEME, sidebarBg: '#ffffff', sidebarText: '#ffffff' };
  expect(applyPortalTheme(theme)).toEqual(theme);
  expect(value('sidebar-text')).not.toBe('#ffffff');
  expect(theme.sidebarText).toBe('#ffffff');
});
