import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { CodedError } from 'expo-modules-core';

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

export class AppleSignInCancelledError extends Error {
  constructor() {
    super('Login Apple annullato');
    this.name = 'AppleSignInCancelledError';
  }
}

export interface AppleSignInResult {
  identityToken: string;
  fullName: string | null;
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Nessun identityToken ricevuto da Apple');
    }

    // Apple restituisce fullName solo alla primissima autorizzazione dell'app.
    const fullName = credential.fullName
      ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ') || null
      : null;

    return { identityToken: credential.identityToken, fullName };
  } catch (err) {
    if (err instanceof CodedError && err.code === 'ERR_REQUEST_CANCELED') {
      throw new AppleSignInCancelledError();
    }
    console.error('[oauth] Apple Sign-In error:', JSON.stringify(err, Object.getOwnPropertyNames(err as object)));
    throw err;
  }
}
