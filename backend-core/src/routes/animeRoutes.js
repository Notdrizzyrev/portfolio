import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to anime.json
const animeDataPath = path.join(__dirname, '../data/anime.json');

// Helper function to read anime data
const readAnimeData = () => {
  try {
    const data = fs.readFileSync(animeDataPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading anime data:', error);
    return [];
  }
};

// GET /api/anime/search - Search anime by title
router.get('/anime/search', (req, res) => {
  try {
    const query = req.query.q?.toLowerCase() || '';
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query is required' 
      });
    }

    const animeList = readAnimeData();
    
    // Search through anime data
    const results = animeList.filter(anime => 
      anime.title.toLowerCase().includes(query) ||
      anime.alternativeTitle?.toLowerCase().includes(query) ||
      anime.genres?.some(g => g.toLowerCase().includes(query))
    );

    res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error searching anime' 
    });
  }
});

// GET /api/anime/:id - Get anime details by ID
router.get('/anime/:id', (req, res) => {
  try {
    const { id } = req.params;
    const animeList = readAnimeData();
    
    const anime = animeList.find(a => a.id === parseInt(id));
    
    if (!anime) {
      return res.status(404).json({ 
        success: false, 
        message: 'Anime not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: anime
    });
  } catch (error) {
    console.error('Details error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching anime details' 
    });
  }
});

// GET /api/anime/trending - Get trending anime
router.get('/anime/trending', (req, res) => {
  try {
    const animeList = readAnimeData();
    
    // Sort by score/popularity and return top 10
    const trending = animeList
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 10);

    res.status(200).json({
      success: true,
      count: trending.length,
      data: trending
    });
  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching trending anime' 
    });
  }
});

// GET /api/anime/genre/:genre - Get anime by genre
router.get('/anime/genre/:genre', (req, res) => {
  try {
    const { genre } = req.params;
    const animeList = readAnimeData();
    
    const results = animeList.filter(anime =>
      anime.genres?.some(g => g.toLowerCase() === genre.toLowerCase())
    );

    res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('Genre error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching anime by genre' 
    });
  }
});

export default router;