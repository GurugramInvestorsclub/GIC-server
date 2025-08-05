const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const suppabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!suppabaseUrl || !supabaseKey) {
    console.error("Missing Supbase Credentials")
    process.exit(1);
}

const supabase = createClient(suppabaseUrl, supabaseKey);

module.exports = supabase;