'use strict';

const http = require("request-promise-native")
const { networkInterfaces } = require("os");

let Service, Characteristic, Formats, Perms, Units;
let host, serial, firmwareVersion;
let active = 0;
let temperature = 0;
let targetTemperature = 10;
let mode = "auto";
let oscillate = 0;
let fanOn = 0;
let rotationSpeed = 0;
let name = "Airco";
let uid;
let logger;


/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 * @since 0.1.0
 * 
 * @description Manager class of the Innova Air Co.
 */
class InnovaAirCo {

  constructor(log, config) {
    logger = log;
    this.log = log;
    this.name = config.name || this.name;
    this.host = config.host;
    this.fanControl = config.fan;
    host = config.host;
    this.connect();

    this.info = new Service.AccessoryInformation()
      .setCharacteristic(Characteristic.Manufacturer, "Innova")

    this.info
      .getCharacteristic(Characteristic.Model)
      .on("get", ((cb) => cb(null, uid)).bind(this));

    this.info
      .getCharacteristic(Characteristic.SerialNumber)
      .on("get", ((cb) => cb(null, serial)).bind(this));

    this.info
      .getCharacteristic(Characteristic.FirmwareRevision)
      .on("get", ((cb) => cb(null, firmwareVersion)).bind(this));

    this.airco = new Service.HeaterCooler(this.name);

    if (this.fanControl) {

      this.fan = new Service.Fan(this.name);

      this.fan
        .getCharacteristic(Characteristic.On)
        .on("get", (cb => cb(null, fanOn)).bind(this))
        .on("set", this.setOn.bind(this));

      this.fan
        .getCharacteristic(Characteristic.RotationSpeed)
        .on("get", (cb => cb(null, rotationSpeed)).bind(this))
        .on("set", this.setRotationSpeed.bind(this));

    }

    this.airco
      .getCharacteristic(Characteristic.Active)
      .on("get", (cb => cb(null, active)).bind(this))
      .on("set", this.setActive.bind(this));

    this.airco
      .getCharacteristic(Characteristic.Name)
      .on("get", (cb => cb(null, name)).bind(this))
      .on("set", this.setName.bind(this));

    this.airco
      .getCharacteristic(Characteristic.SwingMode)
      .on("get", (cb => cb(null, oscillate)).bind(this))
      .on("set", this.setSwingMode.bind(this));

    this.airco
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on("get", this.getCurrentTemperature.bind(this))

    this.airco
      .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
      .on("get", this.getCurrentHeaterCoolerState.bind(this))

    this.airco
      .getCharacteristic(Characteristic.TargetHeaterCoolerState)
      .on("get", this.getTargetHeaterCoolerState.bind(this))
      .on("set", this.setTargetHeaterCoolerState.bind(this));

    this.airco
      .getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .on("get", this.getCoolingThresholdTemperature.bind(this))
      .on("set", this.setCoolingThresholdTemperature.bind(this));

    this.airco
      .getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .on("get", this.getHeatingThresholdTemperature.bind(this))
      .on("set", this.setHeatingThresholdTemperature.bind(this));

  }

  connect() {
    const log = this.log;
    (async () => {
      try {
        if (!host) {
          log.info("Host is not set: Starting device discovery...");
          const ips = await discover();
          if (ips.length > 0) {
            const ip = ips[0]
            log.info(`Innova device found: ${ip}`);
            host = ip;
          }
        }
        const res = await getStatus({ full: true })
        uid = res.UID;
        firmwareVersion = res.sw.V;
        serial = res.setup.serial;
        name = res.setup.name;
      } catch { }
    })();
  }

  async setOn(state, cb) {
    try {
      if (state && rotationSpeed == 0) {
        rotationSpeed = 3;
      }
      await sendCommand(`set/fan`, { value: state ? rotationSpeed : 0 });
      fanOn = state;
    } catch { }
    cb(null, fanOn);
  }

  async setName(value, cb) {
    try {
      await sendCommand(`setup`, { serial: serial, name: value });
      name = value;
    } catch { }
    cb(null, name);
  }

  async setRotationSpeed(state, cb) {
    this.log.info(`setRotationSpeed: ${state}`);
    try {
      const innovaScale = Math.ceil(state / 34);
      await sendCommand(`set/fan`, { value: innovaScale });
      rotationSpeed = innovaScale;
    } catch { }
    cb(null, rotationSpeed);
  }

  async setActive(state, cb) {
    this.log.info(`setActive: ${state}`);
    try {
      await sendCommand(`power/${state ? "on" : "off"}`);
      active = state;
    } catch { }
    cb(null, active);
  }

  async setTargetHeaterCoolerState(state, cb) {
    this.log.info(`setTargetHeaterCoolerState: ${state}`);
    try {
      mode = homekitToInnovaMode(state);
      await sendCommand(`set/mode/${mode}`);
    } catch { }
    cb(null, innovaToHomekitMode(mode));
  }

  async setSwingMode(state, cb) {
    this.log.info(`setSwingMode: ${state}`);
    try {
      await sendCommand("set/feature/rotation", { value: state ? 0 : 1 });
      oscillate = state;
    } catch { }
    cb(null, oscillate);
  }

  async setCoolingThresholdTemperature(value, cb) {
    this.log.info(`setCoolingThresholdTemperature: ${value}`);
    try {
      await sendCommand("set/mode/cooling");
      await sendCommand("set/setpoint", { p_temp: value });
      targetTemperature = value;
    } catch { }
    cb(null, targetTemperature);
  }

  async setHeatingThresholdTemperature(value, cb) {
    this.log.info(`setHeatingThresholdTemperature: ${value}`);
    try {
      await sendCommand("set/mode/heating");
      await sendCommand("set/setpoint", { p_temp: value });
      targetTemperature = value;
    } catch { }
    cb(null, targetTemperature);
  }

  getCurrentHeaterCoolerState(cb) {
    if (!active) return cb(null, Characteristic.CurrentHeaterCoolerState.INACTIVE);
    switch (mode) {
      case "auto": return cb(null, Characteristic.CurrentHeaterCoolerState.COOLING); // ??
      case "cooling": return cb(null, Characteristic.CurrentHeaterCoolerState.COOLING);
      case "heating": return cb(null, Characteristic.CurrentHeaterCoolerState.HEATING);
    }
    cb(null, Characteristic.CurrentHeaterCoolerState.IDLE);
  }

  getTargetHeaterCoolerState(cb) {
    cb(null, innovaToHomekitMode(mode));
  }

  getCurrentTemperature(cb) {
    getStatus().then(({ t }) => {
      temperature = t
    });
    cb(null, temperature);
  }

  getCoolingThresholdTemperature(cb) {
    getStatus().then(({ sp }) => {
      targetTemperature = sp;
    })
    cb(null, targetTemperature);
  }

  getHeatingThresholdTemperature(cb) {
    getStatus().then(({ sp }) => {
      targetTemperature = sp;
    })
    cb(null, targetTemperature);
  }

  getServices() {
    const services = [this.info, this.airco];
    if (this.fanControl) services.push(this.fan)
    return services;
  }

}


module.exports = api => {

  Service = api.hap.Service;
  Characteristic = api.hap.Characteristic;
  Formats = api.hap.Formats;
  Perms = api.hap.Perms;
  Units = api.hap.Units;

  api.registerAccessory("InnovaAirCo", InnovaAirCo);
  // api.registerPlatform('homebridge-innova', 'InnovaAirCo', InnovaAirCo, true);

};

function homekitToInnovaMode(value) {
  switch (value) {
    case 0: return "auto";
    case 1: return "heating";
    case 2: return "cooling";
    default: return null
  }
}
function innovaToHomekitMode(value) {
  switch (value) {
    case "auto": return 0;
    case "heating": return 1;
    case "cooling": return 2;
    default: return null
  }
}

function getStatus(options = {}) {
  const full = options.full === true;
  return new Promise(async (resolve, reject) => {
    try {
      const url = `http://${host}/api/v/1/status`
      if (logger) {
        logger.debug(url);
      }
      const response = await http(url, { json: {} });
      if (response.success === true) return resolve(full ? response : response.RESULT);
    } catch { }
    reject();
  });
}

function sendCommand(topic, params = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const query = Object.keys(params).map(x => `${x}=${params[x]}`).join("&");
      const url = `http://${host}/api/v/1/${topic}?${query}`
      if (logger) {
        logger.debug(url);
      }
      const response = await http.post(url, { json: {} });
      if (response.success === true) return resolve(response);
    } catch { }
    reject();
  });
}

/**
 * @description Finds the IP addresses of host.
 * 
 * @returns {string[]} An array of IP addresses
 */
function getOwnIPs() {
  const nets = networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
      if (net.family === familyV4Value && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results
}

/**
* @description Finds the IP addresses of all v1 compatible devices in the network
* 
* @returns {Promise<string[]>} A promise that resolves to an array of IP addresses
*/
async function discover() {
  const networks = getOwnIPs().map(ip => { return ip.split(".").slice(0, -1).join("."); });
  const promises = [];
  for (const network of networks) {
    for (let i = 0; i < 256; i++) {
      const ip = `${network}.${i}`
      promises.push(new Promise(async (resolve, reject) => {
        try {
          const response = await http(`http://${ip}/api/v/1/status`, { json: {}, timeout: 3000 });
          if (response.success === true) {
            return resolve(ip);
          }
        } catch { }
        reject();
      }));
    }
  }
  const results = await Promise.allSettled(promises);
  return results.filter(x => x.status == "fulfilled").map(x => x.value);
}
