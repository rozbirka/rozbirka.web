/** Keep production measurement out of QA, local and copied preview artifacts. */
export function marketingTags() {
  return `<script>
(function () {
  if (window.location.protocol !== 'https:' || window.location.hostname !== 'rozbirka.pro') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({'gtm.start': new Date().getTime(), event: 'gtm.js'});
  function gtag(){window.dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-D35DJ28PLE');
  for (const src of [
    'https://www.googletagmanager.com/gtm.js?id=GTM-MV5L2BBG',
    'https://www.googletagmanager.com/gtag/js?id=G-D35DJ28PLE'
  ]) {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  }
})();
</script>`
}
