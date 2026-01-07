// feature-context-toggle/backend/src/database.ts
import { Pool } from 'pg';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema: string;
}

export class DatabaseManager {
  private pool: Pool;
  private config: DatabaseConfig;

  constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'confuse_shared', // Same as other services
      user: process.env.DB_USER || 'confuse',
      password: process.env.DB_PASSWORD || 'confuse_pg_secret',
      schema: 'feature_toggles'
    };

    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Set default schema
    this.pool.on('connect', (client) => {
      client.query(`SET search_path TO ${this.config.schema}, public`);
    });
  }

  async getToggle(name: string) {
    const result = await this.pool.query(
      'SELECT * FROM toggles WHERE name = $1',
      [name]
    );
    return result.rows[0] || null;
  }

  async getAllToggles() {
    const result = await this.pool.query(
      'SELECT * FROM toggles ORDER BY category, name'
    );
    return result.rows;
  }

  async updateToggle(name: string, enabled: boolean) {
    const result = await this.pool.query(
      'UPDATE toggles SET enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE name = $2 RETURNING *',
      [enabled, name]
    );
    return result.rows[0] || null;
  }

  async getDemoUser(toggleName: string = 'authBypass') {
    const result = await this.pool.query(
      'SELECT metadata->>\'demoUser\' as demo_user FROM toggles WHERE name = $1 AND enabled = true',
      [toggleName]
    );
    
    if (result.rows[0]?.demo_user) {
      return JSON.parse(result.rows[0].demo_user);
    }
    return null;
  }

  async close() {
    await this.pool.end();
  }
}

export const db = new DatabaseManager();