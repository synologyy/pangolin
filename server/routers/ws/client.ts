import WebSocket from 'ws';
import axios from 'axios';
import { URL } from 'url';
import { EventEmitter } from 'events';

export interface Config {
  id: string;
  secret: string;
  endpoint: string;
}

export interface WSMessage {
  type: string;
  data: any;
}

export interface TokenResponse {
  success: boolean;
  message?: string;
  data: {
    token: string;
  };
}

export type MessageHandler = (message: WSMessage) => void;

export interface ClientOptions {
  baseURL?: string;
  reconnectInterval?: number;
  pingInterval?: number;
  pingTimeout?: number;
}

export class WebSocketClient extends EventEmitter {
  private conn: WebSocket | null = null;
  private config: Config;
  private baseURL: string;
  private handlers: Map<string, MessageHandler> = new Map();
  private reconnectInterval: number;
  private isConnected: boolean = false;
  private pingInterval: number;
  private pingTimeout: number;
  private clientType: string;
  private shouldReconnect: boolean = true;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private pingTimeoutTimer: NodeJS.Timeout | null = null;

  constructor(
    clientType: string,
    id: string,
    secret: string,
    endpoint: string,
    options: ClientOptions = {}
  ) {
    super();
    
    this.clientType = clientType;
    this.config = {
      id,
      secret,
      endpoint
    };
    
    this.baseURL = options.baseURL || endpoint;
    this.reconnectInterval = options.reconnectInterval || 3000;
    this.pingInterval = options.pingInterval || 30000;
    this.pingTimeout = options.pingTimeout || 10000;
  }

  public getConfig(): Config {
    return this.config;
  }

  public async connect(): Promise<void> {
    this.shouldReconnect = true;
    await this.connectWithRetry();
  }

  public async close(): Promise<void> {
    this.shouldReconnect = false;
    
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = null;
    }

    if (this.conn) {
      this.conn.close(1000, 'Client closing');
      this.conn = null;
    }
    
    this.setConnected(false);
  }

  public sendMessage(messageType: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.conn || this.conn.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      const message: WSMessage = {
        type: messageType,
        data: data
      };

      console.debug(`Sending message: ${messageType}`, data);
      
      this.conn.send(JSON.stringify(message), (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  public sendMessageInterval(
    messageType: string, 
    data: any, 
    interval: number
  ): () => void {
    // Send immediately
    this.sendMessage(messageType, data).catch(err => {
      console.error('Failed to send initial message:', err);
    });

    // Set up interval
    const intervalId = setInterval(() => {
      this.sendMessage(messageType, data).catch(err => {
        console.error('Failed to send message:', err);
      });
    }, interval);

    // Return stop function
    return () => {
      clearInterval(intervalId);
    };
  }

  public registerHandler(messageType: string, handler: MessageHandler): void {
    this.handlers.set(messageType, handler);
  }

  public unregisterHandler(messageType: string): void {
    this.handlers.delete(messageType);
  }

  public isClientConnected(): boolean {
    return this.isConnected;
  }

  private async getToken(): Promise<string> {
    const baseURL = new URL(this.baseURL);
    const tokenEndpoint = `${baseURL.origin}/api/v1/auth/${this.clientType}/get-token`;

    const tokenData = this.clientType === 'newt' 
      ? { newtId: this.config.id, secret: this.config.secret }
      : { olmId: this.config.id, secret: this.config.secret };

    try {
      const response = await axios.post<TokenResponse>(tokenEndpoint, tokenData, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'x-csrf-protection'
        },
        timeout: 10000 // 10 second timeout
      });

      if (!response.data.success) {
        throw new Error(`Failed to get token: ${response.data.message}`);
      }

      if (!response.data.data.token) {
        throw new Error('Received empty token from server');
      }

      console.debug(`Received token: ${response.data.data.token}`);
      return response.data.data.token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(`Failed to get token with status code: ${error.response.status}`);
        } else if (error.request) {
          throw new Error('Failed to request new token: No response received');
        } else {
          throw new Error(`Failed to request new token: ${error.message}`);
        }
      } else {
        throw new Error(`Failed to get token: ${error}`);
      }
    }
  }

  private async connectWithRetry(): Promise<void> {
    while (this.shouldReconnect) {
      try {
        await this.establishConnection();
        return;
      } catch (error) {
        console.error(`Failed to connect: ${error}. Retrying in ${this.reconnectInterval}ms...`);
        
        if (!this.shouldReconnect) return;
        
        await new Promise(resolve => {
          this.reconnectTimer = setTimeout(resolve, this.reconnectInterval);
        });
      }
    }
  }

  private async establishConnection(): Promise<void> {
    // Get token for authentication
    const token = await this.getToken();
    this.emit('tokenUpdate', token);

    // Parse the base URL to determine protocol and hostname
    const baseURL = new URL(this.baseURL);
    const wsProtocol = baseURL.protocol === 'https:' ? 'wss' : 'ws';
    const wsURL = new URL(`${wsProtocol}://${baseURL.host}/api/v1/ws`);
    
    // Add token and client type to query parameters
    wsURL.searchParams.set('token', token);
    wsURL.searchParams.set('clientType', this.clientType);

    return new Promise((resolve, reject) => {
      const conn = new WebSocket(wsURL.toString());

      conn.on('open', () => {
        console.debug('WebSocket connection established');
        this.conn = conn;
        this.setConnected(true);
        this.startPingMonitor();
        this.emit('connect');
        resolve();
      });

      conn.on('message', (data: WebSocket.Data) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          const handler = this.handlers.get(message.type);
          if (handler) {
            handler(message);
          }
          this.emit('message', message);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });

      conn.on('close', (code, reason) => {
        console.debug(`WebSocket connection closed: ${code} ${reason}`);
        this.handleDisconnect();
      });

      conn.on('error', (error) => {
        console.error('WebSocket error:', error);
        if (this.conn === null) {
          // Connection failed during establishment
          reject(error);
        } else {
          this.handleDisconnect();
        }
      });

      conn.on('pong', () => {
        if (this.pingTimeoutTimer) {
          clearTimeout(this.pingTimeoutTimer);
          this.pingTimeoutTimer = null;
        }
      });
    });
  }

  private startPingMonitor(): void {
    this.pingTimer = setInterval(() => {
      if (this.conn && this.conn.readyState === WebSocket.OPEN) {
        this.conn.ping();
        
        // Set timeout for pong response
        this.pingTimeoutTimer = setTimeout(() => {
          console.error('Ping timeout - no pong received');
          this.handleDisconnect();
        }, this.pingTimeout);
      }
    }, this.pingInterval);
  }

  private handleDisconnect(): void {
    this.setConnected(false);
    
    // Clear ping timers
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = null;
    }

    if (this.conn) {
      this.conn.removeAllListeners();
      this.conn = null;
    }

    this.emit('disconnect');

    // Reconnect if needed
    if (this.shouldReconnect) {
      this.connectWithRetry();
    }
  }

  private setConnected(status: boolean): void {
    this.isConnected = status;
  }
}

// Factory function for easier instantiation
export function createWebSocketClient(
  clientType: string,
  id: string,
  secret: string,
  endpoint: string,
  options?: ClientOptions
): WebSocketClient {
  return new WebSocketClient(clientType, id, secret, endpoint, options);
}

export default WebSocketClient;