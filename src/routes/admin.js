const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const Track = require('../models/Track');
const Playlist = require('../models/Playlist');
const User = require('../models/User');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fileUpload = require('express-fileupload');

router.use(fileUpload());

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
        const fileKey = `music/${Date.now()}-${file.name}`;

        const s3Client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });

        // S3'e yükle
        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileKey,
            Body: file.data,
            ContentType: file.mimetype
        }));

        // Veritabanına kaydet
        const track = new Track({
            title: req.body.title,
            artist: req.body.artist,
            category: req.body.category,
            isPremium: req.body.isPremium === 'on',
            fileUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`,
            duration: req.body.duration || 0 // Gerçek süreyi hesaplamak için ek işlem gerekebilir
        });

        await track.save();
        res.status(201).json(track);
    } catch (error) {
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
        const track = await Track.findByIdAndDelete(req.params.id);

        if (!track) {
            return res.status(404).json({ message: 'Müzik bulunamadı' });
        }

        // S3'ten dosyayı sil
        const fileKey = track.fileUrl.split('/').pop();
        const s3Client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });

        await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileKey
        }));

        res.json({ message: 'Müzik başarıyla silindi' });
    } catch (error) {
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

module.exports = router;