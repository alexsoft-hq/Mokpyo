function checkedUrl(value: string): URL {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && loopback))) {
    throw new Error('MCP requires HTTPS (HTTP is allowed only on loopback), without credentials, query or fragment.');
  }
  return url;
}

export function getAppUrl(): string {
  return checkedUrl(process.env.APP_URL || 'http://localhost:8080').href.replace(/\/$/, '');
}

export function getMcpUrl(): string {
  const url = checkedUrl(process.env.MCP_PUBLIC_URL || new URL('/mcp', getAppUrl()).href);
  if (url.pathname !== '/mcp') throw new Error('MCP_PUBLIC_URL must have the path /mcp.');
  return url.href;
}

export function getMcpIssuer(): string {
  return new URL(getMcpUrl()).origin;
}

export function goalUrl(goalId: string): string {
  const url = new URL(`${getAppUrl()}/`);
  url.searchParams.set('item', goalId);
  return url.href;
}
