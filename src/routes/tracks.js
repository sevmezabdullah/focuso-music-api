const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const Track = require('../models/Track');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Tüm müzikleri listele (filtreleme ile)
router.get('/', auth, async (req, res) => {
  try {
    const { category, isPremium } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (isPremium === 'true') {
      // Premium içerik kontrolü
      if (!req.user.isPremium) {
        return res.status(403).json({
          message: 'Premium içerikleri görüntülemek için premium üye olmalısınız',
          isPremiumContent: true
        });
      }
      filter.isPremium = true;
    }

    const tracks = await Track.find(filter).sort('-createdAt');
    res.json(tracks);
  } catch (error) {
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Yeni müzik ekle (sadece admin)
router.post('/', [auth, admin], async (req, res) => {
  try {
    const {
      title,
      artist,
      duration,
      category,
      isPremium,
      tags
    } = req.body;

    const file = req.files.audio;
    const fileKey = `music/${Date.now()}-${file.name}`;

    // Müzik dosyasını S3'e yükle
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
      Body: file.data,
      ContentType: file.mimetype
    });

    await s3Client.send(uploadCommand);

    const track = new Track({
      title,
      artist,
      duration,
      category,
      isPremium: isPremium || false,
      tags: tags || [],
      fileUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`
    });

    await track.save();
    res.status(201).json(track);
  } catch (error) {
    console.error('Müzik yükleme hatası:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Müzik detaylarını güncelle (sadece admin)
router.put('/:trackId', [auth, admin], async (req, res) => {
  try {
    const track = await Track.findByIdAndUpdate(
      req.params.trackId,
      {
        $set: {
          title: req.body.title,
          artist: req.body.artist,
          category: req.body.category,
          isPremium: req.body.isPremium,
          tags: req.body.tags
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

// Müzik sil (sadece admin)
router.delete('/:trackId', [auth, admin], async (req, res) => {
  try {
    const track = await Track.findByIdAndDelete(req.params.trackId);

    if (!track) {
      return res.status(404).json({ message: 'Müzik bulunamadı' });
    }

    // S3'ten müzik dosyasını sil
    const fileKey = track.fileUrl.split('/').pop();
    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey
    });

    await s3Client.send(deleteCommand);

    res.json({ message: 'Müzik silindi' });
  } catch (error) {
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;