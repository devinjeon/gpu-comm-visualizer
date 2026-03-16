const GA_ID = 'G-EKRKX6NWS9';

export function initGA() {
  if (document.querySelector(`script[src*="googletagmanager"]`)) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID);
}

export function trackEvent(name, params) {
  if (window.gtag) window.gtag('event', name, params);
}
