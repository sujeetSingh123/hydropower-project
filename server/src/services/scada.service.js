/**
 * SCADA Integration Service
 *
 * Supports:
 *   - OPC UA (node-opcua)
 *   - Simulator mode for development/testing
 *
 * Architecture: this module manages the connection lifecycle and exposes
 * a readAll() method.  The poller worker calls readAll() on its schedule
 * and persists the results.
 */

const opcua = require('node-opcua');
const env = require('../config/env');
const logger = require('../utils/logger');

// ─── Simulator ─────────────────────────────────────────────────────────────

let _simState = {
  'Generator.Power': 3200,
  'Generator.Frequency': 50.01,
  'Generator.Voltage_RY': 410,
  'Generator.Voltage_YB': 411,
  'Generator.Voltage_BR': 410,
  'Generator.Current_R': 450,
  'Generator.Current_Y': 452,
  'Generator.Current_B': 448,
  'Generator.PowerFactor': 0.92,
  'Generator.kVAR': 680,
  'Generator.Temperature': 62,
  'Plant.TotalEnergy': 128450,
  'Plant.WaterLevel': 8.4,
  'Turbine.Speed': 375,
};

const _drift = {
  'Generator.Power': { min: 2800, max: 4800, step: 80 },
  'Generator.Frequency': { min: 49.5, max: 50.5, step: 0.05 },
  'Generator.Voltage_RY': { min: 395, max: 425, step: 2 },
  'Generator.Voltage_YB': { min: 395, max: 425, step: 2 },
  'Generator.Voltage_BR': { min: 395, max: 425, step: 2 },
  'Generator.Current_R': { min: 350, max: 700, step: 15 },
  'Generator.Current_Y': { min: 350, max: 700, step: 15 },
  'Generator.Current_B': { min: 350, max: 700, step: 15 },
  'Generator.PowerFactor': { min: 0.78, max: 0.99, step: 0.01 },
  'Generator.kVAR': { min: 100, max: 1800, step: 30 },
  'Generator.Temperature': { min: 45, max: 88, step: 0.5 },
  'Plant.TotalEnergy': { min: 0, max: Infinity, step: 0.5 },
  'Plant.WaterLevel': { min: 5.5, max: 12.0, step: 0.05 },
  'Turbine.Speed': { min: 300, max: 420, step: 3 },
};

function simulateRead(tags) {
  const now = new Date();
  return tags.map((tag) => {
    const d = _drift[tag.tag_name];
    let v = _simState[tag.tag_name] ?? 0;
    if (d) {
      const delta = (Math.random() - 0.48) * d.step;
      v = Math.min(d.max, Math.max(d.min, v + delta));
      // Energy meter only increments
      if (tag.tag_name === 'Plant.TotalEnergy') v = Math.max(v, _simState[tag.tag_name] ?? 0);
      _simState[tag.tag_name] = v;
    }
    return { tag_name: tag.tag_name, tag_id: tag.id, value: parseFloat(v.toFixed(4)), quality: 192, timestamp: now };
  });
}

// ─── OPC UA Client ──────────────────────────────────────────────────────────

class OpcUaScadaClient {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.client = null;
    this.session = null;
    this.connected = false;
    this._retryCount = 0;
  }

  async connect() {
    try {
      this.client = opcua.OPCUAClient.create({
        applicationName: 'HydropowerMonitor',
        connectionStrategy: {
          initialDelay: 1000,
          maxRetry: env.scada.maxRetries,
        },
        securityMode: opcua.MessageSecurityMode.None,
        securityPolicy: opcua.SecurityPolicy.None,
        endpointMustExist: false,
      });

      this.client.on('connection_lost', () => {
        logger.warn('OPC UA connection lost');
        this.connected = false;
      });
      this.client.on('reconnecting', () => logger.info('OPC UA reconnecting...'));
      this.client.on('connection_reestablished', () => {
        logger.info('OPC UA connection reestablished');
        this.connected = true;
      });

      await this.client.connect(this.endpoint);
      this.session = await this.client.createSession();
      this.connected = true;
      this._retryCount = 0;
      logger.info('OPC UA connected', { endpoint: this.endpoint });
    } catch (err) {
      this._retryCount += 1;
      logger.error('OPC UA connect failed', { error: err.message, retry: this._retryCount });
      this.connected = false;
      throw err;
    }
  }

  async readTags(tags) {
    if (!this.connected || !this.session) throw new Error('OPC UA not connected');

    const nodeIds = tags.map((t) => ({ nodeId: t.opc_node_id, attributeId: opcua.AttributeIds.Value }));
    const results = await this.session.read(nodeIds);
    const now = new Date();

    return results.map((r, i) => ({
      tag_name: tags[i].tag_name,
      tag_id: tags[i].id,
      value: r.value?.value ?? null,
      quality: r.statusCode?.value ?? 0,
      timestamp: r.sourceTimestamp || now,
    }));
  }

  async disconnect() {
    try {
      if (this.session) await this.session.close();
      if (this.client) await this.client.disconnect();
    } catch (_) {}
    this.connected = false;
  }
}

// ─── Exported Service ────────────────────────────────────────────────────────

class ScadaService {
  constructor() {
    this._opcClient = null;
    this._mode = env.scada.simulatorMode ? 'simulator' : 'opcua';
  }

  get isSimulator() {
    return this._mode === 'simulator';
  }

  get isConnected() {
    return this._mode === 'simulator' || (this._opcClient?.connected ?? false);
  }

  async initialize() {
    if (this._mode === 'simulator') {
      logger.info('SCADA running in SIMULATOR mode');
      return;
    }
    this._opcClient = new OpcUaScadaClient(env.scada.opcUaEndpoint);
    await this._opcClient.connect();
  }

  async readAll(tags) {
    if (this._mode === 'simulator') return simulateRead(tags);
    if (!this._opcClient?.connected) {
      try {
        await this._opcClient.connect();
      } catch (_) {
        logger.warn('OPC UA unavailable, skipping poll cycle');
        return [];
      }
    }
    return this._opcClient.readTags(tags);
  }

  async shutdown() {
    if (this._opcClient) await this._opcClient.disconnect();
  }

  getSimulatorState() {
    return { ..._simState };
  }
}

module.exports = new ScadaService();
