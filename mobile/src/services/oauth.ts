import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!,
});

export async function signInWithGoogle(): Promise<string> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();

  if (response.type !== 'success' || !response.data.idToken) {
    throw new Error('Nessun id_token ricevuto da Google');
  }

  return response.data.idToken;
}
