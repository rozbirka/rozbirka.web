/** Keep production measurement out of QA, local and copied preview artifacts. */
export function marketingTags(enabled = false) {
  if (!enabled) return ''
  return `<script>
(function () {
  if (window.location.protocol !== 'https:' || window.location.hostname !== 'rozbirka.pro') return;
  if (window.__rozbirkaMarketingInitialized) return;
  window.__rozbirkaMarketingInitialized = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({'gtm.start': new Date().getTime(), event: 'gtm.js'});
  function gtag(){window.dataLayer.push(arguments);}
  gtag('js', new Date());
  const page = new URL(window.location.href);
  for (const key of [...page.searchParams.keys()]) {
    if (!['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].includes(key)) page.searchParams.delete(key);
  }
  page.hash = '';
  gtag('config', 'G-D35DJ28PLE', {page_location: page.href, page_referrer: '', page_title: 'Rozbirka', allow_google_signals: false, allow_ad_personalization_signals: false});
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
