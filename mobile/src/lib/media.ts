/**
 * Type of an image returned by expo-image-picker. With a quality below 1 the
 * picker re-encodes the file (JPEG, or PNG for .png sources) while still
 * reporting the source type (GIF, HEIC...), which the storage bucket would
 * refuse: name the type after the file actually produced.
 */
export function pickedImageType(uri: string): string {
  const path = uri.toLowerCase().split('?')[0];
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}
