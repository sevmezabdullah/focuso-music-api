const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const Track = require('../models/Track');
const Playlist = require('../models/Playlist');
const User = require('../models/User');
const fileUpload = require('express-fileupload');
const { getAudioDurationInSeconds } = require('get-audio-duration');

router.use(fileUpload({
    limits: { 
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    abortOnLimit: true
}));

// Müzik dosyaları için temel dizin
const MUSIC_DIR = path.join(__dirname, '../../uploads/music');

// Dizinin varlığını kontrol et ve oluştur
if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
}

// Ana sayfa
router.get('/', [auth, admin], async (req, res) => {
    try {
        const stats = {
            totalTracks: await Track.countDocuments(),
            premiumTracks: await Track.countDocuments({ isPremium: true }),
            totalPlaylists: await Playlist.countDocuments(),
            totalUsers: await User.countDocuments()
        };

        res.render('dashboard', {
            isHome: true,
            stats
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Sunucu hatası' });
    }
});

// Müzik listesi
router.get('/tracks', [auth, admin], async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.category) filter.category = req.query.category;
        if (req.query.isPremium) filter.isPremium = req.query.isPremium === 'true';

        const totalTracks = await Track.countDocuments(filter);
        const totalPages = Math.ceil(totalTracks / limit);

        const tracks = await Track.find(filter)
            .sort('-createdAt')
            .skip(skip)
            .limit(limit);

        const pagination = {
            current: page,
            pages: Array.from({ length: totalPages }, (_, i) => ({
                number: i + 1,
                current: i + 1 === page
            })),
            hasPrev: page > 1,
            hasNext: page < totalPages,
            prev: page - 1,
            next: page + 1
        };

        res.render('tracks', {
            isTracks: true,
            tracks,
            pagination,
            filters: {
                category: req.query.category,
                isPremium: req.query.isPremium
            }
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Sunucu hatası' });
    }
});

// Yeni müzik ekle
router.post('/tracks', [auth, admin], async (req, res) => {
    try {
        if (!req.files || !req.files.audio) {
            return res.status(400).json({ message: 'Müzik dosyası gerekli' });
        }

        const file = req.files.audio;
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = path.join(MUSIC_DIR, fileName);

        // Dosyayı kaydet
        await file.mv(filePath);

        // Müzik süresini hesapla
        const duration = await getAudioDurationInSeconds(filePath);

        // Veritabanına kaydet
        const track = new Track({
            title: req.body.title,
            artist: req.body.artist,
            category: req.body.category,
            isPremium: req.body.isPremium === 'on',
            fileName: fileName,
            mimeType: file.mimetype,
            fileSize: file.size,
            duration: Math.round(duration)
        });

        await track.save();
        res.status(201).json(track);
    } catch (error) {
        // Hata durumunda dosyayı sil
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        console.error('Müzik yükleme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

// Müzik güncelle
router.put('/tracks/:id', [auth, admin], async (req, res) => {
    try {
        const track = await Track.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    title: req.body.title,
                    artist: req.body.artist,
                    category: req.body.category,
                    isPremium: req.body.isPremium === 'on'
                }
            },
            { new: true }
        );

        if (!track) {
            return res.status(404).json({ message: 'Müzik bulunamadı' });
        }

        res.json(track);
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

// Müzik sil
router.delete('/tracks/:id', [auth, admin], async (req, res) => {
    try {
        const track = await Track.findById(req.params.id);

        if (!track) {
            return res.status(404).json({ message: 'Müzik bulunamadı' });
        }

        // Dosyayı sil
        const filePath = path.join(MUSIC_DIR, track.fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await track.deleteOne();
        res.json({ message: 'Müzik başarıyla silindi' });
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

module.exports = router;