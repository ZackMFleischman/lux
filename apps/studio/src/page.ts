/** Generate a local page with a per-launch style nonce for Emotion/MUI. */
export function createStudioPage(template: string, assetDirectory: string, nonce: string): string {
  const directory = new URL(assetDirectory);
  if (directory.protocol !== 'file:') throw Error('Studio assets must be local');
  if (!/^[A-Za-z0-9+/=]{24,64}$/.test(nonce)) throw Error('Invalid style nonce');
  return template.replaceAll('__STYLE_NONCE__', nonce)
    .replaceAll('__RENDERER_JS__', new URL('renderer.js', directory).href)
    .replaceAll('__RENDERER_CSS__', new URL('renderer.css', directory).href);
}
