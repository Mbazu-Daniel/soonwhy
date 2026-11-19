export interface OidcSettings {
  providerId: string;
  name: string;
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
}
