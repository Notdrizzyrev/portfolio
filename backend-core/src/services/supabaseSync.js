import { createClient } from '@supabase/supabase-js';
import animeData from '../data/anime.json' assert { type: 'json' };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export const syncAnimeToSupabase = async () => {
  try {
    console.log("🔄 Syncing anime to Supabase...");
    
    // Check if data already exists
    const { count } = await supabase
      .from('anime')
      .select('*', { count: 'exact', head: true });
    
    if (count === 0 || count === null) {
      // Insert new data
      const { error } = await supabase
        .from('anime')
        .insert(animeData);
      
      if (error) throw error;
      console.log('✅ Anime synced to Supabase backup!');
    } else {
      console.log('✅ Anime already in Supabase backup!');
    }
  } catch (error) {
    console.warn('⚠️  Supabase sync failed (non-critical):', error.message);
  }
};
