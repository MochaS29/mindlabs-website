/* PostHog analytics for mochasmindlab.com.
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

    /* Key conversions for the umbrella hub: app store clicks, sibling-brand
       clicks, and contact clicks. Pageviews are captured automatically.

       Every event goes to GA4 *and* PostHog from this one listener. GA4 is the
       property that reports on this site, and before this it saw a store click
       only from the sticky bar and from the comparison page, so the homepage
       hero and store badges — the buttons that actually earn the download —
       were invisible to it. */
    function track(name, props) {
        try { if (window.gtag) gtag('event', name, props); } catch (e) {}
        try { if (window.posthog) posthog.capture(name, props); } catch (e) {}
    }

    /* Match store links by the app's own id, not by the store host. The hub
       links to Mindful Meal Plans on the App Store too (about.html), and a
       host-wide match counted those as MindLab Fitness downloads. */
    var IOS_APP_ID = 'id6752837101';
    var ANDROID_APP_ID = 'com.mochasmindlab.mlhealth';

    /* The sibling brands this hub sends traffic to. Each one is a separate
       brand with its own analytics; without an event here, all it ever sees is
       an undifferentiated referral from mochasmindlab.com. */
    var SIBLINGS = [
        { match: 'mindfulmealplan.com', brand: 'mindful_meal_plans' },
        { match: 'id6787221576', brand: 'mindful_meal_plans' },
        { match: 'happygrants.com', brand: 'happy_grants' },
        { match: 'certalot.com', brand: 'certalot' },
        { match: 'mochashmigelsky.com', brand: 'mocha_shmigelsky' }
    ];

    function siblingBrand(href) {
        for (var i = 0; i < SIBLINGS.length; i++) {
            if (href.indexOf(SIBLINGS[i].match) !== -1) return SIBLINGS[i].brand;
        }
        return '';
    }

    document.addEventListener('click', function (e) {
        var link = e.target.closest ? e.target.closest('a[href]') : null;
        if (!link) return;
        var href = link.getAttribute('href') || '';
        var page = location.pathname;
        var brand = siblingBrand(href);

        if (brand) {
            track('network_click', { brand: brand, href: href, page: page });
            /* Keep the series the consultant-site funnel was built on. */
            if (brand === 'mocha_shmigelsky' && window.posthog) {
                posthog.capture('consultant_site_click', { href: href, page: page });
            }
        } else if (href.indexOf(IOS_APP_ID) !== -1) {
            track('store_click', { store: 'ios', placement: 'inline', href: href, page: page });
        } else if (href.indexOf(ANDROID_APP_ID) !== -1) {
            track('store_click', { store: 'android', placement: 'inline', href: href, page: page });
        } else if (href.indexOf('mailto:') === 0) {
            track('contact_click', { href: href, page: page });
        }
    }, true);
})();
