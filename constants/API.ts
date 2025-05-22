export const API_ENDPOINT = 'https://d61f-185-19-132-69.ngrok-free.app/v1';

export function getPublicImageUrl(path: string) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/uploads')) {
    return `https://d61f-185-19-132-69.ngrok-free.app/public${path}`;
  }
  return path;
}