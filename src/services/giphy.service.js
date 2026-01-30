// Giphy service for GIF search
// For production, get your own API key at https://developers.giphy.com/

// Try multiple API keys
const GIPHY_API_KEYS = [
    'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh', // Public key
    'Gc7131jiJuvI7IdN0HZ1D7nh0ow5BU6g', // Alternative
];

let currentKeyIndex = 0;
const GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs';

// Fallback popular GIFs when API fails
const FALLBACK_GIFS = [
    { id: '1', title: 'Thumbs Up', url: 'https://media.giphy.com/media/3o7TKU8RvQuomFfUUU/giphy.gif', smallUrl: 'https://media.giphy.com/media/3o7TKU8RvQuomFfUUU/200w.gif', width: 200, height: 200 },
    { id: '2', title: 'Party', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', smallUrl: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200w.gif', width: 200, height: 200 },
    { id: '3', title: 'Happy Dance', url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif', smallUrl: 'https://media.giphy.com/media/5GoVLqeAOo6PK/200w.gif', width: 200, height: 200 },
    { id: '4', title: 'Love', url: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif', smallUrl: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/200w.gif', width: 200, height: 200 },
    { id: '5', title: 'Laughing', url: 'https://media.giphy.com/media/O5NyCibf93upy/giphy.gif', smallUrl: 'https://media.giphy.com/media/O5NyCibf93upy/200w.gif', width: 200, height: 200 },
    { id: '6', title: 'Mind Blown', url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif', smallUrl: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/200w.gif', width: 200, height: 200 },
    { id: '7', title: 'Clapping', url: 'https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif', smallUrl: 'https://media.giphy.com/media/7rj2ZgttvgomY/200w.gif', width: 200, height: 200 },
    { id: '8', title: 'High Five', url: 'https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/giphy.gif', smallUrl: 'https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/200w.gif', width: 200, height: 200 },
    { id: '9', title: 'Thinking', url: 'https://media.giphy.com/media/CaiVJuZGvR8HK/giphy.gif', smallUrl: 'https://media.giphy.com/media/CaiVJuZGvR8HK/200w.gif', width: 200, height: 200 },
    { id: '10', title: 'Wave', url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', smallUrl: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/200w.gif', width: 200, height: 200 },
    { id: '11', title: 'Excited', url: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif', smallUrl: 'https://media.giphy.com/media/5VKbvrjxpVJCM/200w.gif', width: 200, height: 200 },
    { id: '12', title: 'Cool', url: 'https://media.giphy.com/media/62PP2yEIAZF6g/giphy.gif', smallUrl: 'https://media.giphy.com/media/62PP2yEIAZF6g/200w.gif', width: 200, height: 200 },
    { id: '13', title: 'Sad', url: 'https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif', smallUrl: 'https://media.giphy.com/media/d2lcHJTG5Tscg/200w.gif', width: 200, height: 200 },
    { id: '14', title: 'Wow', url: 'https://media.giphy.com/media/l0MYEqEzwMWFCg8rm/giphy.gif', smallUrl: 'https://media.giphy.com/media/l0MYEqEzwMWFCg8rm/200w.gif', width: 200, height: 200 },
    { id: '15', title: 'Yes', url: 'https://media.giphy.com/media/3o7TKF5DnsSLv4zVBu/giphy.gif', smallUrl: 'https://media.giphy.com/media/3o7TKF5DnsSLv4zVBu/200w.gif', width: 200, height: 200 },
    { id: '16', title: 'No', url: 'https://media.giphy.com/media/d10dMmzqCYqQ0/giphy.gif', smallUrl: 'https://media.giphy.com/media/d10dMmzqCYqQ0/200w.gif', width: 200, height: 200 },
    { id: '17', title: 'Facepalm', url: 'https://media.giphy.com/media/XsUtdIeJ0MWMo/giphy.gif', smallUrl: 'https://media.giphy.com/media/XsUtdIeJ0MWMo/200w.gif', width: 200, height: 200 },
    { id: '18', title: 'Mic Drop', url: 'https://media.giphy.com/media/3o7qDSOvfaCO9b3MlO/giphy.gif', smallUrl: 'https://media.giphy.com/media/3o7qDSOvfaCO9b3MlO/200w.gif', width: 200, height: 200 },
    { id: '19', title: 'Coffee', url: 'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif', smallUrl: 'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/200w.gif', width: 200, height: 200 },
    { id: '20', title: 'Thank You', url: 'https://media.giphy.com/media/3oEjHWXddcCOGZNmFO/giphy.gif', smallUrl: 'https://media.giphy.com/media/3oEjHWXddcCOGZNmFO/200w.gif', width: 200, height: 200 },
];

function getCurrentApiKey() {
    return GIPHY_API_KEYS[currentKeyIndex];
}

function tryNextApiKey() {
    currentKeyIndex = (currentKeyIndex + 1) % GIPHY_API_KEYS.length;
}

/**
 * Search for GIFs
 */
export async function searchGifs(query, limit = 20, offset = 0) {
    // Try API first
    for (let attempt = 0; attempt < GIPHY_API_KEYS.length; attempt++) {
        try {
            const response = await fetch(
                `${GIPHY_BASE_URL}/search?api_key=${getCurrentApiKey()}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&rating=pg-13`
            );

            if (response.ok) {
                const data = await response.json();
                return data.data.map(gif => ({
                    id: gif.id,
                    title: gif.title,
                    url: gif.images.fixed_height.url,
                    smallUrl: gif.images.fixed_height_small?.url || gif.images.fixed_height.url,
                    width: parseInt(gif.images.fixed_height.width),
                    height: parseInt(gif.images.fixed_height.height)
                }));
            }

            // Try next key on failure
            tryNextApiKey();
        } catch (error) {
            console.warn('Giphy search attempt failed:', error);
            tryNextApiKey();
        }
    }

    // Fallback: filter fallback GIFs by query
    console.log('Using fallback GIFs for search');
    const lowerQuery = query.toLowerCase();
    return FALLBACK_GIFS.filter(gif =>
        gif.title.toLowerCase().includes(lowerQuery)
    ).slice(0, limit);
}

/**
 * Get trending GIFs
 */
export async function getTrendingGifs(limit = 20, offset = 0) {
    // Try API first
    for (let attempt = 0; attempt < GIPHY_API_KEYS.length; attempt++) {
        try {
            const response = await fetch(
                `${GIPHY_BASE_URL}/trending?api_key=${getCurrentApiKey()}&limit=${limit}&offset=${offset}&rating=pg-13`
            );

            if (response.ok) {
                const data = await response.json();
                return data.data.map(gif => ({
                    id: gif.id,
                    title: gif.title,
                    url: gif.images.fixed_height.url,
                    smallUrl: gif.images.fixed_height_small?.url || gif.images.fixed_height.url,
                    width: parseInt(gif.images.fixed_height.width),
                    height: parseInt(gif.images.fixed_height.height)
                }));
            }

            // Try next key on failure
            tryNextApiKey();
        } catch (error) {
            console.warn('Giphy trending attempt failed:', error);
            tryNextApiKey();
        }
    }

    // Fallback to static GIFs
    console.log('Using fallback GIFs for trending');
    return FALLBACK_GIFS.slice(offset, offset + limit);
}

/**
 * Get a random GIF for a tag
 */
export async function getRandomGif(tag = '') {
    // Try API first
    for (let attempt = 0; attempt < GIPHY_API_KEYS.length; attempt++) {
        try {
            const url = tag
                ? `${GIPHY_BASE_URL}/random?api_key=${getCurrentApiKey()}&tag=${encodeURIComponent(tag)}&rating=pg-13`
                : `${GIPHY_BASE_URL}/random?api_key=${getCurrentApiKey()}&rating=pg-13`;

            const response = await fetch(url);

            if (response.ok) {
                const data = await response.json();
                const gif = data.data;

                return {
                    id: gif.id,
                    title: gif.title,
                    url: gif.images.fixed_height.url,
                    smallUrl: gif.images.fixed_height_small?.url || gif.images.fixed_height.url,
                    width: parseInt(gif.images.fixed_height.width),
                    height: parseInt(gif.images.fixed_height.height)
                };
            }

            tryNextApiKey();
        } catch (error) {
            console.warn('Giphy random attempt failed:', error);
            tryNextApiKey();
        }
    }

    // Fallback to random from static GIFs
    console.log('Using fallback GIF for random');
    const randomIndex = Math.floor(Math.random() * FALLBACK_GIFS.length);
    return FALLBACK_GIFS[randomIndex];
}

/**
 * Get fallback GIFs (for direct access)
 */
export function getFallbackGifs() {
    return FALLBACK_GIFS;
}
