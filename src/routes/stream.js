const express = require('express');
const router = express.Router();
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const auth = require('../middleware/auth');
const Track = require('../models/Track');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

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

    // S3'ten müzik dosyasını al
    const key = track.fileUrl.split('/').pop();
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key
    });

    const { Body, ContentType, ContentLength } = await s3Client.send(command);

    // Streaming için header'ları ayarla
    res.setHeader('Content-Type', ContentType);
    res.setHeader('Content-Length', ContentLength);
    res.setHeader('Accept-Ranges', 'bytes');

    // Müzik akışını başlat
    Body.pipe(res);
  } catch (error) {
    console.error('Streaming hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;