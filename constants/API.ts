const url = 'aa3a-77-241-136-45.ngrok-free.app/';
export const baseurl = 'https://' + url;
export const wsurl = 'wss://' + url;
const apiurl = baseurl + 'v1/';
export const includeCredentials = true;

import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'worker_app_access_token';
const REFRESH_TOKEN_KEY = 'worker_app_refresh_token';

export async function saveTokens(accessToken: string, refreshToken: string) {
  console.log('Saving tokens:', accessToken, refreshToken);
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
  ]);
  console.log(await getAccessToken(), await getRefreshToken());
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}


const validateUrl = (url: string) => {
  if (!url.includes('?') && !url.endsWith('/')) {
    return url + '/';
  }
  return url;
};

export function getPublicImageUrl(path: string) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/uploads')) {
    return `${baseurl}public${path}`;
  }
  return path;
}

export const reauthenticate = async () => {
  await fetch(getApiUrl('auth/refresh-token/'), {
      method: 'POST',
      credentials: 'include',
      headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getRefreshToken()}`,
      },
      body: JSON.stringify({}),
  }).then((res) => {
      if (res.status === 401) {
          sessionStorage.removeItem('role');
          window.location.href = '/';
      } else if (res.status === 200) {
          return res.json().then(async (data) => {
              await saveTokens(data.access_token, data.refresh_token);
          });
      }
  });
}

const getApiUrl = (path: string) => {
    return validateUrl(apiurl + path);
}

export const post = async (path: string, body: any, tried: boolean = false): Promise<any> => {
  const accessToken = await getAccessToken();
  const response = await fetch(getApiUrl(path), {
      method: 'POST',
      credentials: 'include',
      headers: {
          'Content-Type': 'application/json',
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
      },
      body: JSON.stringify(body),
  });
  if (response.status === 401 && !tried) {
      await reauthenticate();
      return post(path, body, true);
  }
  const text = await response.text(); 
  console.log('Sign-in response text:', text);
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = text;
  } 
  console.log('Sign-in response data:', data);
  if (path == 'auth/sign-in/?client_id=customer') {
    console.log('access_token:', data.access_token, 'refresh_token:', data.refresh_token);
    await saveTokens(data.access_token, data.refresh_token);
    console.log('Saved tokens:', await getAccessToken(), await getRefreshToken());
  }
  return {
      status: response.status,
      data: data,
  };
}

export const get = async (path: string, tried: boolean = false): Promise<any> => {
  const accessToken = await getAccessToken();
  let response = await fetch(getApiUrl(path), {
      method: 'GET',
      credentials: 'include',
      headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
      },
  });
  if (response.status === 401 && !tried) {
      await reauthenticate();
      return get(path, true);
  }
  return {
      status: response.status,
      data: await response.json(),
  };
}

export const patch = async (path: string, body: any, tried: boolean = false): Promise<any> => {
  const accessToken = await getAccessToken();
  let response = await fetch(getApiUrl(path), {
      method: 'PATCH',
      credentials: 'include',
      headers: {
          'Content-Type': 'application/json',
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
      },
      body: JSON.stringify(body),
  });
  if (response.status === 401 && !tried) {
      await reauthenticate();
      return patch(path, body, true);
  }
  return {
      status: response.status,
      data: await response.json(),
  };
}

export const del = async (path: string, tried: boolean = false): Promise<any> => {
  const accessToken = await getAccessToken();
  let response = await fetch(getApiUrl(path), {
      method: 'DELETE',
      credentials: 'include',
      headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
      },
  });
  if (response.status === 401 && !tried) {
      await reauthenticate();
      return del(path, true);
  }
  return {
      status: response.status,
      data: await response.json(),
  };
}

export const postImage = async (path: string, data: FormData, tried: boolean = false): Promise<any> => {
  const accessToken = await getAccessToken();
  let response = await fetch(getApiUrl(path), {
      method: 'POST',
      credentials: 'include',
      headers: {
          Authorization: accessToken ? `Bearer ${accessToken}` : '',
      },
      body: data,
  });
  if (response.status === 401 && !tried) {
      await reauthenticate();
      return postImage(path, data, true);
  }
  return {
      status: response.status,
      data: await response.json(),
  };
}