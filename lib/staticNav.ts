/**
 * Hard-navigation helper for the static export running inside Capacitor.
 *
 * Next.js `output: export` emits directory-style routes (e.g. `/admin/signin`
 * becomes `/admin/signin/index.html`). Inside the Capacitor WebView there is no
 * server to rewrite an extensionless path to its `index.html`, so plain
 * `<a href="/admin/signin">` links and `router.push('/admin')` calls fail to
 * resolve and the WebView falls back to the start page (the dashboard).
 *
 * `goTo()` normalizes any app path to its physical `index.html` file and does a
 * full-page navigation, which resolves reliably both in the browser and the APK.
 */
export function goTo(path: string): void {
  if (typeof window === 'undefined') return;
  let p = path === '/' ? '/index.html' : path;
  if (!p.endsWith('.html')) {
    p = p.replace(/\/+$/, '') + '/index.html';
  }
  window.location.href = window.location.origin + p;
}
