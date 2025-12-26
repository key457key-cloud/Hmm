
export const AVATARS = [
  'https://i.postimg.cc/J7cRW2Y6/86DE4C.png',
  'https://i.postimg.cc/v8LGdN23/9765.png',
  'https://i.postimg.cc/qBXpd5Dy/9766.png',
  'https://i.postimg.cc/v8LGdN2v/C2CF6E8.png',
];

export const COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-yellow-500',
  'bg-indigo-500',
];

// Define colors available in the shop
export const SHOP_ITEMS = [
  { id: 'neon-blue', name: 'Neon Blue', class: 'text-cyan-400', price: 10 },
  { id: 'gold', name: 'Golden Legend', class: 'text-yellow-400', price: 10 },
  { id: 'rose', name: 'Rose Pink', class: 'text-pink-400', price: 10 },
  { id: 'lime', name: 'Toxic Lime', class: 'text-lime-400', price: 10 },
  { id: 'red', name: 'Red Alert', class: 'text-red-500', price: 10 },
  { id: 'purple', name: 'Royal Purple', class: 'text-purple-400', price: 10 },
];

export const API_CONFIG_KEY = 'gemini_chat_api_url';

export const getApiUrl = (endpoint: string) => {
  if (typeof window === 'undefined') return endpoint;
  let baseUrl = localStorage.getItem(API_CONFIG_KEY) || '';
  // Remove trailing slash if present to avoid double slashes //
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  return `${baseUrl}${endpoint}`;
};
