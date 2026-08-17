import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import { preparaContenuto, callGemini } from './src/lib/geminiClient.js' // wait, geminiClient is probably just a wrapper
// Let's just call the proxy directly or test the schema directly.
