export interface McpActor {
  userId: string;
  userName: string;
  organizationId: string;
  tokenId: string;
  scopes: string[];
}

/** Safe, client-facing errors. Never expose raw database errors over MCP. */
export class McpError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'McpError';
  }
}

export const MCP_READ_SCOPE = 'mokpyo:read';
export const MCP_WRITE_SCOPE = 'mokpyo:write';
