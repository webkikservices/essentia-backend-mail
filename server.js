const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer');
require('dotenv').config();

const app = express();

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ============================================
// EMAIL TRANSPORTERS
// ============================================
const contactTransporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: { user: process.env.CONTACT_EMAIL, pass: process.env.CONTACT_PASS },
    tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
});

const careerTransporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: { user: process.env.CAREER_EMAIL, pass: process.env.CAREER_PASS },
    tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
});

// ============================================
// INSTAGRAM — HELPER FUNCTIONS
// ============================================
async function fetchCarouselChildren(postId, token) {
    try {
        const url = `https://graph.facebook.com/v19.0/${postId}/children?fields=id,media_type,media_url,thumbnail_url&access_token=${token}`;
        const res = await fetch(url);
        const data = await res.json();
        return data.data || [];
    } catch { return []; }
}

async function fetchAllPostsFromIG(token, userId) {
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
    let allPosts = [];
    let nextUrl = `https://graph.facebook.com/v19.0/${userId}/media?fields=${fields}&limit=100&access_token=${token}`;

    while (nextUrl) {
        const response = await fetch(nextUrl);
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const posts = await Promise.all(data.data.map(async (post) => {
            if (post.media_type === 'CAROUSEL_ALBUM') {
                post.children = await fetchCarouselChildren(post.id, token);
            }
            return post;
        }));

        allPosts = [...allPosts, ...posts];
        nextUrl = data.paging?.next || null;
    }
    return allPosts;
}

// ============================================
// INSTAGRAM — IN-MEMORY CACHE
// ============================================
let postsCache = { data: null, lastFetched: null, isFetching: false };

let warmPromise = null;
async function warmPostsCache() {
    if (warmPromise) return warmPromise;
    warmPromise = (async () => {
        console.log('🔄 Warming Instagram cache...');
        try {
            const posts = await fetchAllPostsFromIG(
                process.env.INSTAGRAM_ACCESS_TOKEN,
                process.env.INSTAGRAM_USER_ID
            );
            postsCache.data = posts;
            postsCache.lastFetched = Date.now();
            console.log(`✅ Cache ready! ${posts.length} posts cached.`);
        } catch (err) {
            console.error('❌ Cache failed:', err.message);
        } finally {
            warmPromise = null;
        }
    })();
    return warmPromise;
}

// ============================================
// INSTAGRAM — TOKEN AUTO REFRESH
// ============================================
async function refreshInstagramToken() {
    try {
        const token = process.env.INSTAGRAM_ACCESS_TOKEN;
        const url = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.APP_ID}&client_secret=${process.env.APP_SECRET}&fb_exchange_token=${token}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.access_token) {
            process.env.INSTAGRAM_ACCESS_TOKEN = data.access_token;
            console.log('✅ Token refreshed!');
        } else {
            console.error('❌ Token refresh failed:', data);
        }
    } catch (err) {
        console.error('❌ Token refresh error:', err);
    }
}

// Server start timers
setTimeout(refreshInstagramToken, 10000);
setTimeout(warmPostsCache, 5000);
setInterval(refreshInstagramToken, 50 * 24 * 60 * 60 * 1000);
setInterval(warmPostsCache, 30 * 60 * 1000);

// ============================================
// ROUTES — CONTACT
// ============================================
app.post('/api/contact', async (req, res) => {
    const { name, email, phone, subject, message } = req.body;
    try {
        await contactTransporter.sendMail({
            from: process.env.CONTACT_EMAIL,
            to: process.env.CONTACT_EMAIL,
            subject: `New Contact Inquiry: ${subject}`,
            text: `Name: ${name}\nPhone: ${phone}\nEmail: ${email}\nMessage: ${message}`
        });

        const crmPayload = {
            firstName: name || '', lastName: '',
            email: email || '', mobile: phone || '',
            phoneCountryCode: '91', countryCode: '91',
            description: `Subject: ${subject} | Message: ${message}`,
            leadPriority: '1'
        };

        const crmResponse = await fetch('https://crm.my-company.app/api/v1/lead/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'authToken': 'VWZpKCo86kWL51bPx3w5Bg==.pW1kkOIbX+VQTRD7FsboKw==',
                'timeZone': 'Asia/Calcutta'
            },
            body: JSON.stringify(crmPayload)
        });

        if (!crmResponse.ok) {
            const errorText = await crmResponse.text();
            console.error('CRM FAILED:', crmResponse.status, errorText);
            return res.status(500).json({ error: 'CRM Integration Failed' });
        }

        const responseData = await crmResponse.json();
        console.log('Lead pushed to CRM:', responseData);
        res.status(200).json({ message: 'Enquiry sent successfully' });
    } catch (error) {
        console.error('Contact API Error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// ============================================
// ROUTES — CAREER
// ============================================
app.post('/api/career', upload.single('resume'), async (req, res) => {
    const { name, email, phone, category, portfolio, message } = req.body;
    const file = req.file;
    try {
        const mailOptions = {
            subject: `New Job Application: ${category} - ${name}`,
            text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nCategory: ${category}\nPortfolio: ${portfolio}\nMessage: ${message}`,
            attachments: file ? [{ filename: file.originalname, content: file.buffer }] : []
        };
        await contactTransporter.sendMail({ ...mailOptions, from: process.env.CONTACT_EMAIL, to: process.env.CONTACT_EMAIL });
        await careerTransporter.sendMail({ ...mailOptions, from: process.env.CAREER_EMAIL, to: process.env.CAREER_EMAIL });
        res.status(200).json({ message: 'Application sent successfully' });
    } catch (error) {
        console.error('Career Mail Error:', error);
        res.status(500).json({ error: 'Failed to send career email' });
    }
});

// ============================================
// ROUTES — INSTAGRAM
// ============================================

// 1. ALL POSTS — Cache + Pagination (FAST!)
app.get('/api/instagram/all-posts', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    res.set('Cache-Control', 'public, max-age=300');

    try {
        if (!postsCache.data) await warmPostsCache();   // wait, no half-baked fallback

        if (!postsCache.data) {
            return res.status(503).json({ success: false, error: 'Posts loading, thodi der me retry' });
        }

        const start = (page - 1) * limit;
        const end = start + limit;
        return res.status(200).json({
            success: true,
            total: postsCache.data.length,
            page, limit,
            hasMore: end < postsCache.data.length,
            data: postsCache.data.slice(start, end)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


        // Cache nahi — seedha fetch, background mein warm karo
        const token = process.env.INSTAGRAM_ACCESS_TOKEN;
        const userId = process.env.INSTAGRAM_USER_ID;
        const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
        const url = `https://graph.facebook.com/v19.0/${userId}/media?fields=${fields}&limit=${limit}&access_token=${token}`;

        const response = await fetch(url);
        const data = await response.json();
        if (data.error) return res.status(400).json({ success: false, error: data.error.message });

        warmPostsCache();

        res.status(200).json({
            success: true, total: null, page: 1, limit,
            hasMore: !!data.paging?.next,
            data: data.data
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. LATEST POSTS
app.get('/api/instagram/latest', async (req, res) => {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const userId = process.env.INSTAGRAM_USER_ID;
    const limit = req.query.limit || 12;
    try {
        // Cache se nikalo agar available ho
        if (postsCache.data) {
            return res.status(200).json({
                success: true,
                count: Math.min(limit, postsCache.data.length),
                data: postsCache.data.slice(0, limit)
            });
        }
        const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
        const url = `https://graph.facebook.com/v19.0/${userId}/media?fields=${fields}&limit=${limit}&access_token=${token}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) return res.status(400).json({ success: false, error: data.error.message });
        res.status(200).json({ success: true, count: data.data.length, data: data.data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch posts' });
    }
});

// 3. REELS
app.get('/api/instagram/reels', async (req, res) => {
    try {
        const source = postsCache.data || await fetchAllPostsFromIG(
            process.env.INSTAGRAM_ACCESS_TOKEN, process.env.INSTAGRAM_USER_ID
        );
        const reels = source.filter(p => p.media_type === 'VIDEO');
        res.status(200).json({ success: true, count: reels.length, data: reels });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch reels' });
    }
});

// 4. PROFILE
app.get('/api/instagram/profile', async (req, res) => {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const userId = process.env.INSTAGRAM_USER_ID;
    try {
        const fields = 'id,name,username,biography,profile_picture_url,followers_count,follows_count,media_count,website';
        const url = `https://graph.facebook.com/v19.0/${userId}?fields=${fields}&access_token=${token}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) return res.status(400).json({ success: false, error: data.error.message });
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch profile' });
    }
});

// 5. SINGLE POST
app.get('/api/instagram/post/:postId', async (req, res) => {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const { postId } = req.params;
    try {
        // Cache mein dhundo pehle
        if (postsCache.data) {
            const cached = postsCache.data.find(p => p.id === postId);
            if (cached) return res.status(200).json({ success: true, data: cached });
        }
        const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
        const url = `https://graph.facebook.com/v19.0/${postId}?fields=${fields}&access_token=${token}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) return res.status(400).json({ success: false, error: data.error.message });
        if (data.media_type === 'CAROUSEL_ALBUM') {
            data.children = await fetchCarouselChildren(postId, token);
        }
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch post' });
    }
});

// 6. COMMENTS
app.get('/api/instagram/comments/:postId', async (req, res) => {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const { postId } = req.params;
    try {
        const url = `https://graph.facebook.com/v19.0/${postId}/comments?fields=id,text,timestamp,username&access_token=${token}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.error) return res.status(400).json({ success: false, error: data.error.message });
        res.status(200).json({ success: true, count: data.data?.length || 0, data: data.data || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch comments' });
    }
});

// ============================================
// WEBHOOK
// ============================================
app.get('/webhook/instagram', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
        console.log('✅ Webhook verified!');
        res.status(200).send(challenge);
    } else {
        res.status(403).send('Forbidden');
    }
});

app.post('/webhook/instagram', (req, res) => {
    const body = req.body;
    if (body.object === 'instagram') {
        body.entry?.forEach(entry => {
            entry.changes?.forEach(change => {
                if (change.field === 'media') {
                    console.log('🆕 New post! Refreshing cache...');
                    warmPostsCache(); // Nai post aate hi cache refresh
                }
            });
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.status(404).send('Not Found');
    }
});

// ============================================
// SERVER START
// ============================================
module.exports = app;
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
