// The public demo build (RMS_PUBLIC=1) marks <body> with .rms-public: no official marks on screens or letters.
export function isPublic() {
  return typeof document !== 'undefined' && !!document.body && document.body.classList.contains('rms-public');
}
