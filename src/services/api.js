// Data layer facade.
// Demo mode (no .env keys): reads/writes go to the Zustand store with demo data.
// Live mode (env keys present): reads/writes go to Supabase via the service layer.
import { supabaseConfigured } from '../services/supabase';

export const DEMO_MODE = !supabaseConfigured;
