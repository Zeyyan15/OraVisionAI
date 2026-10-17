import { File } from 'expo-file-system';
import type { UploadAsset } from './uploadFile';

export async function uploadBlob(asset: UploadAsset): Promise<Blob> {
  try {
    // Expo fetch supports File's bytes() interface directly. React Native's
    // global Blob cannot be constructed from Uint8Array/ArrayBuffer data.
    const file = new File(asset.uri);
    if (!file.exists) throw new Error('Selected file no longer exists');
    return file;
  } catch {
    throw new Error('Cannot read the selected file. Please choose it again.');
  }
}
