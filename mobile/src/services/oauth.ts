import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

export async function signInWithGoogle(): Promise<string> {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'fiora' });

  const request = new AuthSession.AuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!,
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
    responseType: AuthSession.ResponseType.IdToken,
    usePKCE: false,
    extraParams: {
      nonce: Math.random().toString(36).slice(2),
    },
  });

  const result = await request.promptAsync(GOOGLE_DISCOVERY);

  if (result.type !== 'success') {
    throw new Error('Login Google annullato');
  }

  const idToken = result.params.id_token;
  if (!idToken) {
    throw new Error('Nessun id_token ricevuto da Google');
  }

  return idToken;
}
