import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import MicrosoftEntraId from "@auth/core/providers/microsoft-entra-id";

const CustomPassword = Password({
  profile: (params) => {
    return {
      email: params.email as string,
      name: params.name as string,
    };
  },
});

const providers: any[] = [CustomPassword];
if (process.env.AUTH_GOOGLE_CLIENT_ID) {
  providers.push(Google({
    clientId: process.env.AUTH_GOOGLE_CLIENT_ID,
    clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
  }));
}
if (process.env.AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID) {
  providers.push(MicrosoftEntraId({
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_CLIENT_SECRET,
    issuer: `https://login.microsoftonline.com/common/v2.0`,
  }));
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
});
