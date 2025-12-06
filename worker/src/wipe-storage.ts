import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'spatters-pixels';

async function wipeStorage() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log(`Listing files in bucket: ${BUCKET}...`);
  
  // List all files in the bucket
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: 1000 });

  if (listError) {
    console.error('Error listing files:', listError.message);
    process.exit(1);
  }

  if (!files || files.length === 0) {
    console.log('Bucket is already empty.');
    return;
  }

  console.log(`Found ${files.length} files to delete.`);

  // Get file paths
  const filePaths = files.map(f => f.name);
  console.log('Files:', filePaths);

  // Confirm deletion
  console.log('\nDeleting all files...');

  const { data, error: deleteError } = await supabase.storage
    .from(BUCKET)
    .remove(filePaths);

  if (deleteError) {
    console.error('Error deleting files:', deleteError.message);
    process.exit(1);
  }

  console.log(`✅ Successfully deleted ${filePaths.length} files from ${BUCKET}`);
}

wipeStorage().catch(console.error);

