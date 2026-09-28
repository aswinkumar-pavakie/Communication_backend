export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface JwtRefreshPayload extends JwtPayload {
  tokenId: string;
}
