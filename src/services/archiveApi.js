import { getSupabase, supabaseConfigured } from './supabase';

const BUCKET = 'system-archive';

function fromRow(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description ?? '',
    fileName: row.file_name,
    mimeType: row.mime_type ?? 'application/octet-stream',
    size: Number(row.file_size) || 0,
    zipSize: Number(row.zip_size) || 0,
    createdBy: row.created_by_name ?? '—',
    createdAt: row.created_at,
    originalPath: row.original_path,
    zipPath: row.zip_path,
    remote: true,
  };
}

async function client() {
  if (!supabaseConfigured) throw new Error('File storage is unavailable. Please contact an administrator.');
  const supabase = await getSupabase();
  if (!supabase) throw new Error('File storage is unavailable. Please try again later.');
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.access_token) throw new Error('Sign in to use the shared archive.');
  return { supabase, user: session.user };
}

export const supabaseArchiveEnabled = supabaseConfigured;

export async function listSupabaseArchiveFiles() {
  const { supabase } = await client();
  const { data, error } = await supabase.from('archive_files').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}

export async function uploadSupabaseArchive({ file, zip, metadata }) {
  const { supabase, user } = await client();
  const originalPath = `${metadata.id}/original`;
  const zipPath = `${metadata.id}/archive.zip`;
  const bucket = supabase.storage.from(BUCKET);
  const { error: originalError } = await bucket.upload(originalPath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (originalError) throw originalError;
  const { error: zipError } = await bucket.upload(zipPath, zip, { contentType: 'application/zip', upsert: false });
  if (zipError) {
    await bucket.remove([originalPath]);
    throw zipError;
  }
  const { data, error } = await supabase.from('archive_files').insert({
    id: metadata.id,
    title: metadata.title,
    category: metadata.category,
    description: metadata.description,
    file_name: metadata.fileName,
    mime_type: metadata.mimeType,
    file_size: metadata.size,
    zip_size: zip.size,
    original_path: originalPath,
    zip_path: zipPath,
    created_by: user.id,
    created_by_name: metadata.createdBy,
  }).select().single();
  if (error) {
    await bucket.remove([originalPath, zipPath]);
    throw error;
  }
  return fromRow(data);
}

export async function getSupabaseArchiveContent(file) {
  const { supabase } = await client();
  const { data, error } = await supabase.storage.from(BUCKET).download(file.originalPath);
  if (error) throw error;
  return data;
}

export async function getSupabaseArchiveZip(file) {
  const { supabase } = await client();
  const { data, error } = await supabase.storage.from(BUCKET).download(file.zipPath);
  if (error) throw error;
  return data;
}

export async function deleteSupabaseArchiveFile(file) {
  const { supabase } = await client();
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([file.originalPath, file.zipPath]);
  if (storageError) throw storageError;
  const { error } = await supabase.from('archive_files').delete().eq('id', file.id);
  if (error) throw error;
}
