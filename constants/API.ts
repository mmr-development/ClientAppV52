export const API_ENDPOINT = 'https://3a30-77-241-136-45.ngrok-free.app/v1';

export function getPublicImageUrl(path: string) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/uploads')) {
    return `https://3a30-77-241-136-45.ngrok-free.app/public${path}`;
  }
  return path;
}