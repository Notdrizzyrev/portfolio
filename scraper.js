// Append this to your scraper.js to add URL validation and retry logic

// ── URL VALIDATION & PROVIDER HEALTH CHECK ────────────────────────────────────

async function validateStreamUrl(url, timeout = 5000) {
    try {
        const response = await axios.head(url, {
            timeout,
            maxRedirects: 2,
            headers: {
                'User-Agent': AGENT,
                'Referer': 'https://allanime.day/',
            },
        });
        return response.status >= 200 && response.status < 400;
    } catch (e) {
        console.warn(`[VALIDATE] URL unreachable: ${url.substring(0, 50)}... — ${e.message}`);
        return false;
    }
}

// ── IMPROVED: getEpisodeUrl with validation & fallback ──────────────────────────

async function getEpisodeUrlWithValidation(showId, epNo, mode = 'sub', quality = 'best') {
    try {
        const apiData = await fetchEpisodeApi(showId, mode, epNo);
        if (!apiData) {
            console.log(`[EPISODE] No source data for ${showId} ep ${epNo} (${mode})`);
            return null;
        }

        const entries = extractSourceEntries(apiData);
        if (!entries.length) {
            console.log('[EPISODE] No source entries after parse');
            return null;
        }

        console.log(`[EPISODE] Found ${entries.length} providers: ${entries.map(e => e.sourceName).join(', ')}`);

        // Try every entry we found. Filemoon-style only for Fm-* / *filemoon* names.
        const linkPromises = entries.map(async (entry) => {
            const path = resolveSourcePath(entry.raw);
            if (!path) return [];
            const isFm = /^Fm-/i.test(entry.sourceName) || /filemoon/i.test(entry.sourceName);
            try {
                const links = isFm ? await getFilemoonLinks(path) : await getLinks(path);
                return links.map(l => ({ ...l, provider: entry.sourceName }));
            } catch (e) {
                console.warn(`[EPISODE] Provider "${entry.sourceName}" failed:`, e.message);
                return [];
            }
        });

        const allLinks = (await Promise.all(linkPromises)).flat();
        if (!allLinks.length) {
            console.log('[EPISODE] No playable links extracted from providers');
            return null;
        }

        console.log(`[EPISODE] Got ${allLinks.length} links across ${allLinks.map(l => l.provider).filter((v, i, a) => a.indexOf(v) === i).length} providers`);

        // Quality selection
        const qualityOrder = quality && quality !== 'best'
            ? [String(quality), '1080', '720', '480', '360', 'hls']
            : ['1080', '720', '480', '360', 'hls'];

        // Try each quality tier, validating URLs
        for (const q of qualityOrder) {
            const matching = allLinks.filter(l => String(l.resolution).includes(q));
            for (const link of matching) {
                console.log(`[EPISODE] Trying ${link.provider} @ ${link.resolution}p...`);
                const isValid = await validateStreamUrl(link.url, 5000);
                if (isValid) {
                    console.log(`[EPISODE] ✓ Selected: ${link.provider} @ ${link.resolution}p`);
                    return link.url;
                }
            }
        }

        // Fallback: return first link if validation fails (might be temporarily unreachable)
        console.log('[EPISODE] Validation failed for all links, using fallback (first available)');
        return allLinks[0]?.url || null;
    } catch (e) {
        console.error('[EPISODE] Fatal:', e.message);
        return null;
    }
}

// ── EXPORT: Add to module.exports ─────────────────────────────────────────────

module.exports = {
    searchAnime,
    getAnimeDetails,
    getEpisodesList,
    getEpisodeInfo,
    getEpisodeUrl: getEpisodeUrlWithValidation,  // Replace original with validated version
    getAvailableQualities,
};
