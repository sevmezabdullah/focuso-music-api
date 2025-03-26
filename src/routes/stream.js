const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const Track = require('../models/Track');

// Müzik dosyaları için temel dizin
const MUSIC_DIR = path.join(__dirname, '../../uploads/music');

// Dizinin varlığını kontrol et ve oluştur
if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
}

// Müzik akışı endpoint'i
router.get('/:trackId', auth, async (req, res) => {
    try {
        const track = await Track.findById(req.params.trackId);
        if (!track) {
            return res.status(404).json({ message: 'Müzik bulunamadı' });
        }

        // Premium içerik kontrolü
        if (track.isPremium && !req.user.isPremium) {
            return res.status(403).json({ 
                message: 'Bu içerik sadece premium üyeler için kullanılabilir',
                isPremiumContent: true
            });
        }

        const filePath = path.join(MUSIC_DIR, track.fileName);

        // Dosyanın varlığını kontrol et
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Müzik dosyası bulunamadı' });
        }

        // Dosya bilgilerini al
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            // Range request işleme
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(filePath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': track.mimeType || 'audio/mpeg'
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            // Normal request işleme
            const head = {
                'Content-Length': fileSize,
                'Content-Type': track.mimeType || 'audio/mpeg'
            };
            res.writeHead(200, head);
            fs.createReadStream(filePath).pipe(res);
        }
    } catch (error) {
        console.error('Streaming hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası' });
    }
});

module.exports = router;