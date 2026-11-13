// Adds the standard "this is going away" headers to a response.
// Change SUNSET_V1 to the day before Demo Day (or the date you promise in DEPRECATION_NOTICE.md).
const SUNSET_V1 = '2026-11-14';

function deprecated({ sunset, successor }) {
  return (req, res, next) => {
    // /v1/workers/wk_1 and /workers/wk_1 both point to /v2/workers/wk_1
    const path = req.originalUrl.split('?')[0].replace(/^\/v1(?=\/|$)/, '');
    const target = typeof successor === 'function' ? successor(path) : successor;
    res.set('Deprecation', 'true');
    res.set('Sunset', new Date(sunset).toUTCString());
    res.set('Link', `<${target}>; rel="successor-version"`);
    next();
  };
}

module.exports = { deprecated, SUNSET_V1 };
