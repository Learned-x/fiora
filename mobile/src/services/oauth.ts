import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!,
});

export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('Login Google annullato');
    this.name = 'GoogleSignInCancelledError';
  }
}

export async function signInWithGoogle(): Promise<string> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (response.type === 'cancelled') {
      throw new GoogleSignInCancelledError();
    }
    if (!response.data.idToken) {
      throw new Error('Nessun id_token ricevuto da Google');
    }

    return response.data.idToken;
  } catch (err) {
    if (!(err instanceof GoogleSignInCancelledError)) {
      console.error('[oauth] Google Sign-In error:', JSON.stringify(err, Object.getOwnPropertyNames(err as object)));
    }
    throw err;
  }
}
