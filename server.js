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
// INSTAGRAM — IN-MEMORY CACHE (Vercel-friendly, lazy warm)
// ============================================
let postsCache = { data: null, lastFetched: null };
let warmPromise = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 min

async function getPosts() {
    const fresh = postsCache.data && (Date.now() - postsCache.lastFetched < CACHE_TTL);
    if (fresh) return postsCache.data;
    if (warmPromise) return warmPromise;

    warmPromise = (async () => {
        console.log('🔄 Warming Instagram cache...');
        try {
            const posts = await fetchAllPostsFromIG(
                process.env.INSTAGRAM_ACCESS_TOKEN,
                process.env.INSTAGRAM_USER_ID
            );
            postsCache = { data: posts, lastFetched: Date.now() };
            console.log(`✅ Cache ready! ${posts.length} posts cached.`);
            return posts;
        } catch (err) {
            console.error('❌ Cache failed:', err.message);
            throw err;
        } finally {
            warmPromise = null;
        }
    })();
    return warmPromise;
}

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

// 1. ALL POSTS — Cache + Pagination
app.get('/api/instagram/all-posts', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    res.set('Cache-Control', 'public, max-age=300');

    try {
        const all = await getPosts();

        if (!all || all.length === 0) {
            return res.status(200).json({
                success: true, total: 0, page, limit, hasMore: false, data: []
            });
        }

        const start = (page - 1) * limit;
        const end = start + limit;
        return res.status(200).json({
            success: true,
            total: all.length,
            page, limit,
            hasMore: end < all.length,
            data: all.slice(start, end)
        });
    } catch (error) {
        console.error('all-posts error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// 2. LATEST POSTS
app.get('/api/instagram/latest', async (req, res) => {
    const limit = parseInt(req.query.limit) || 12;
    try {
        const all = await getPosts();
        res.status(200).json({
            success: true,
            count: Math.min(limit, all.length),
            data: all.slice(0, limit)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch posts' });
    }
});

// 3. REELS
app.get('/api/instagram/reels', async (req, res) => {
    try {
        const all = await getPosts();
        const reels = all.filter(p => p.media_type === 'VIDEO');
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
                    console.log('🆕 New post! Invalidating cache...');
                    postsCache = { data: null, lastFetched: null }; // next request lazy-warm karega
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

// Local dev ke liye hi listen karo — Vercel pe app export hota hai
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}
