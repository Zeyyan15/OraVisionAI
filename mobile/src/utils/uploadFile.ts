export type UploadAsset = { uri: string; mimeType?: string | null; file?: Blob };

export async function uploadBlob(asset: UploadAsset): Promise<Blob> {
  if (asset.file) return asset.file;
  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error('Cannot read the selected file. Please choose it again.');
  return response.blob();
}
