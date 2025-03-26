const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Playlist = require('../models/Playlist');
const Track = require('../models/Track');

// Kullanıcının çalma listelerini getir
router.get('/my', auth, async (req, res) => {
  try {
    const playlists = await Playlist.find({ user: req.user.id })
      .populate('tracks')
      .sort('-createdAt');
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Yeni çalma listesi oluştur
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const playlist = new Playlist({
      name,
      description,
      isPublic,
      user: req.user.id
    });
    await playlist.save();
    res.status(201).json(playlist);
  } catch (error) {
    res.status(400).json({ message: 'Geçersiz istek' });
  }
});

// Çalma listesine müzik ekle
router.post('/:playlistId/tracks', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findOne({
      _id: req.params.playlistId,
      user: req.user.id
    });

    if (!playlist) {
      return res.status(404).json({ message: 'Çalma listesi bulunamadı' });
    }

    const track = await Track.findById(req.body.trackId);
    if (!track) {
      return res.status(404).json({ message: 'Müzik bulunamadı' });
    }

    // Premium içerik kontrolü
    if (track.isPremium && !req.user.isPremium) {
      return res.status(403).json({
        message: 'Bu müzik sadece premium üyeler için kullanılabilir',
        isPremiumContent: true
      });
    }

    if (!playlist.tracks.includes(track._id)) {
      playlist.tracks.push(track._id);
      await playlist.save();
    }

    res.json(playlist);
  } catch (error) {
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Çalma listesinden müzik kaldır
router.delete('/:playlistId/tracks/:trackId', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findOne({
      _id: req.params.playlistId,
      user: req.user.id
    });

    if (!playlist) {
      return res.status(404).json({ message: 'Çalma listesi bulunamadı' });
    }

    playlist.tracks = playlist.tracks.filter(
      track => track.toString() !== req.params.trackId
    );
    await playlist.save();

    res.json(playlist);
  } catch (error) {
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Çalma listesi sil
router.delete('/:playlistId', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findOneAndDelete({
      _id: req.params.playlistId,
      user: req.user.id
    });

    if (!playlist) {
      return res.status(404).json({ message: 'Çalma listesi bulunamadı' });
    }

    res.json({ message: 'Çalma listesi silindi' });
  } catch (error) {
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;