/* Analytics for mochasmindlab.com: one track() that fires GA4 and PostHog together,
   so the two tools can never drift. Event names and parameters follow the tracking
   standard (vex docs/TRACKING-STANDARD.md). This site has no forms, so the events are
   page views (automatic), store_click, cta_click, outbound_click and scroll_depth.

   Nothing initialises off the production host: a week of localhost traffic reached
   the live PostHog project before this gate. The GA4 loader in each page's <head>
   carries the same check. The PostHog key is the public project key. */
(function () {
    var PRODUCTION_HOST = 'mochasmindlab.com';
    var POSTHOG_KEY = 'phc_DdUzBKHUgSMBEczTuTsmhZFHcVa4NABMbHJ7qvpxc3Z9';
    var POSTHOG_HOST = 'https://us.i.posthog.com';

    if (location.hostname !== PRODUCTION_HOST || !POSTHOG_KEY) return;

    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getSurveys getActiveMatchingSurveys captureException".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: 'identified_only',
        session_recording: { maskAllInputs: true }
    });

    /* posthog.capture() before the client has finished loading sends nothing and
       throws nothing, so a click early in a page's life reached GA4 only. Events
       wait here until PostHog is loaded (up to 10s), then go in order. The first
       store_click of a visit was the one being lost. */
    var pending = [];
    var waitedMs = 0;

    function phReady() {
        return window.posthog && window.posthog.__loaded;
    }

    function flush() {
        while (pending.length) {
            var e = pending.shift();
            try { posthog.capture(e.name, e.props); } catch (err) {}
        }
    }

    function drain() {
        if (phReady()) { flush(); return; }
        waitedMs += 200;
        if (waitedMs >= 10000) { pending.length = 0; return; }
        setTimeout(drain, 200);
    }

    function capture(name, props) {
        if (phReady()) {
            try { posthog.capture(name, props); } catch (e) {}
        } else {
            pending.push({ name: name, props: props });
            if (pending.length === 1) drain();
        }
    }

    function track(name, props) {
        props.page = document.body.getAttribute('data-page') || location.pathname;
        try { if (window.gtag) gtag('event', name, props); } catch (e) {}
        capture(name, props);
    }

    /* Match store links by the app's own id, not by the store host. The hub
       links to Mindful Meal Plans on the App Store too (about.html), and that
       click belongs to a sibling brand, not to this site's conversion. */
    var IOS_APP_ID = 'id6752837101';
    var ANDROID_APP_ID = 'com.mochasmindlab.mlhealth';
    var APP = 'mindlab_fitness';

    /* The sibling brands this hub sends traffic to, so their outbound clicks
       carry a brand the receiving sites can be matched against. */
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

    /* An explicit data-placement wins (the sticky download bar sets one);
       otherwise the placement is read from where the link sits on the page. */
    function placementOf(link) {
        var marked = link.closest('[data-placement]');
        if (marked) return marked.getAttribute('data-placement');
        if (link.closest('nav, header.site')) return 'nav';
        if (link.closest('footer')) return 'footer';
        if (link.closest('.hero')) return 'hero';
        return 'inline';
    }

    function textOf(link) {
        var text = (link.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) {
            var img = link.querySelector('img[alt]');
            text = img ? img.getAttribute('alt') : '';
        }
        return text.slice(0, 100);
    }

    function slug(text) {
        return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
    }

    /* Capture phase, so a click is recorded before the browser leaves the page.
       This is the only click listener that reports: the download bar marks its
       button with data-placement rather than tracking the click itself, which
       used to send every sticky-bar click twice. */
    document.addEventListener('click', function (e) {
        var link = e.target.closest ? e.target.closest('a[href]') : null;
        if (!link) return;
        var href = link.getAttribute('href') || '';
        var placement = placementOf(link);
        var text = textOf(link);

        if (href.indexOf(IOS_APP_ID) !== -1 || href.indexOf(ANDROID_APP_ID) !== -1) {
            track('store_click', {
                store: href.indexOf(IOS_APP_ID) !== -1 ? 'ios' : 'android',
                app: APP,
                placement: placement
            });
            return;
        }

        if (href.indexOf('mailto:') === 0) {
            var mailbox = href.slice(7).split('@')[0];
            track('cta_click', {
                cta_id: 'email_' + slug(mailbox),
                cta_text: text,
                placement: placement,
                destination: 'mailto'
            });
            return;
        }

        var url;
        try { url = new URL(href, location.href); } catch (err) { return; }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

        if (url.hostname !== location.hostname) {
            var props = { destination_host: url.hostname, link_text: text, placement: placement };
            var brand = siblingBrand(href);
            if (brand) props.brand = brand;
            track('outbound_click', props);
            /* Keep the series the consultant-site funnel was built on. */
            if (brand === 'mocha_shmigelsky') {
                capture('consultant_site_click', { href: href, page: location.pathname });
            }
        } else if (link.classList.contains('btn') || link.hasAttribute('data-cta')) {
            track('cta_click', {
                cta_id: link.getAttribute('data-cta') || slug(text),
                cta_text: text,
                placement: placement,
                destination: url.pathname + url.hash
            });
        }
    }, true);

    /* Scroll depth at 25/50/75/100 %, each sent once per page view. */
    var marks = [25, 50, 75, 100];
    var sent = {};
    function onScroll() {
        var doc = document.documentElement;
        var scrollable = doc.scrollHeight - window.innerHeight;
        var percent = scrollable <= 0 ? 100 : (window.scrollY / scrollable) * 100;
        for (var i = 0; i < marks.length; i++) {
            if (percent >= marks[i] - 1 && !sent[marks[i]]) {
                sent[marks[i]] = true;
                track('scroll_depth', { percent: marks[i] });
            }
        }
        if (sent[100]) window.removeEventListener('scroll', onScroll);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
})();
