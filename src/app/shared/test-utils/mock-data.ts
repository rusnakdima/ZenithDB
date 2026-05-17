export const mockConnectionSummaries: import('@shared/models/connection.config').ConnectionSummary[] = [
  { id: '12345678-1234-1234-1234-123456789012', name: 'Test JSON', provider: 'json', status: 'connected' },
  { id: '22345678-1234-1234-1234-123456789012', name: 'Test Postgres', provider: 'postgresql', status: 'connected' },
];

export const mockConnectionConfigResult: import('@shared/models/connection.config').ConnectionConfigResult = {
  id: '12345678-1234-1234-1234-123456789012',
  config: {
    name: 'Test JSON',
    config: { type: 'Json', name: 'Test JSON', path: '/tmp/test' },
  },
};

export const mockConnectionHealth: import('@shared/models/connection.config').ConnectionHealth = {
  healthy: true,
  provider: 'json',
  server_version: '1.0.0',
  latency_ms: 5,
};

export const mockCollectionMetas: import('@shared/models/connection.config').CollectionMeta[] = [
  { name: 'users', count: 100 },
  { name: 'orders', count: 50 },
];

export const mockCollectionSchema: import('@shared/models/connection.config').CollectionSchema = {
  name: 'users',
  columns: [
    { name: 'id', data_type: 'string', nullable: false, is_primary_key: true },
    { name: 'name', data_type: 'string', nullable: false, is_primary_key: false },
    { name: 'email', data_type: 'string', nullable: true, is_primary_key: false },
  ],
  indexes: [
    { name: 'email_unique', columns: ['email'], is_unique: true },
  ],
};

export const mockCollectionStats: import('@shared/models/connection.config').CollectionStats = {
  name: 'users',
  document_count: 100,
  size_bytes: 4096,
  index_count: 1,
};

export const mockQueryResult: import('@shared/models/connection.config').QueryResult = {
  data: [
    { id: '1', name: 'Alice', email: 'alice@test.com' },
    { id: '2', name: 'Bob', email: 'bob@test.com' },
  ],
  total: 2,
  has_more: false,
};

export const mockSystemMetrics: import('@shared/models/connection.config').SystemMetrics = {
  cpu_usage: 25.5,
  ram_used: 8 * 1024 * 1024 * 1024,
  ram_total: 16 * 1024 * 1024 * 1024,
  disk_used: 100 * 1024 * 1024 * 1024,
  disk_total: 500 * 1024 * 1024 * 1024,
  network_received: 1024 * 1024,
  network_transmitted: 512 * 1024,
  uptime: 3600,
  status: 'optimal',
};

export const mockDatabaseMetadata: import('@shared/models/connection.config').DatabaseMetadata = {
  id: 1,
  connection_id: '12345678-1234-1234-1234-123456789012',
  name: 'testdb',
  path: '/tmp/testdb',
  created_at: Date.now(),
  updated_at: Date.now(),
  metadata: null,
};

export const mockRawResult: import('@shared/models/connection.config').RawResult = {
  columns: ['id', 'name'],
  rows: [['1', 'Alice'], ['2', 'Bob']],
  affected_rows: 2,
};