/* PostHog analytics for mochasmindlab.com (best-practices standard 14).
   The key is the public project API key (safe client-side); file no-ops if it is ever emptied. */
(function () {
    var POSTHOG_KEY = 'phc_DdUzBKHUgSMBEczTuTsmhZFHcVa4NABMbHJ7qvpxc3Z9';
    var POSTHOG_HOST = 'https://us.i.posthog.com';

    if (!POSTHOG_KEY) return;

    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getSurveys getActiveMatchingSurveys captureException".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: 'identified_only'
    });

    /* Key conversions for the umbrella hub: app store clicks, consultant-site
       clicks, and contact clicks. Pageviews are captured automatically. */
    document.addEventListener('click', function (e) {
        var link = e.target.closest ? e.target.closest('a[href]') : null;
        if (!link) return;
        var href = link.getAttribute('href') || '';
        var page = location.pathname;

        if (href.indexOf('apps.apple.com') !== -1) {
            posthog.capture('store_click', { store: 'app_store', href: href, page: page });
        } else if (href.indexOf('play.google.com') !== -1) {
            posthog.capture('store_click', { store: 'google_play', href: href, page: page });
        } else if (href.indexOf('mochashmigelsky.com') !== -1) {
            posthog.capture('consultant_site_click', { href: href, page: page });
        } else if (href.indexOf('mailto:') === 0) {
            posthog.capture('contact_click', { href: href, page: page });
        }
    }, true);
})();
